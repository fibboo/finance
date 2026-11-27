from datetime import date, datetime
from io import BytesIO

import pytest
from openpyxl import Workbook

from app.exceptions.unprocessable_422 import ImportFileInvalid
from app.schemas.accounting.transaction_import import IMPORT_COLUMN_HEADERS, ImportColumn, ImportFileFormat
from app.services.accounting.transaction_import_reader import MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, read_rows


def test_csv_detects_delimiter_and_tracks_physical_row_numbers():
    # arrange
    header = " ; ".join(label.upper() for label in IMPORT_COLUMN_HEADERS.values())
    content = (
        f'{header};Balance\r\n\r\nExpense;2025-01-01;Card;Food;1.25;USD;;;;;;"First\nsecond";100\r\n'
        "expense;2025-01-02;Cash;Food;2;USD;;;;;;;98\r\n"
    ).encode("utf-8-sig")

    # act
    result = read_rows(file_format=ImportFileFormat.CSV, content=content)

    # assert
    assert result.ignored_columns == ["Balance"]
    assert [row.row_number for row in result.rows] == [3, 5]
    assert result.rows[0].cells[ImportColumn.COMMENT].value == "First\nsecond"
    assert result.rows[0].cells[ImportColumn.AMOUNT].value == "1.25"


def test_xlsx_keeps_dates_amounts_and_formulas():
    # arrange
    workbook = Workbook()
    workbook.active.title = "Transactions"
    workbook.active.append(list(IMPORT_COLUMN_HEADERS.values()))
    workbook.active.append(["Expense", date(2025, 3, 2), "Card", "Food", 12.5, "USD"])
    workbook.active.append([])
    workbook.active.append(["Expense", date(2025, 3, 3), "Card", "Food", "=1+2", "USD"])
    content = BytesIO()
    workbook.save(content)

    # act
    result = read_rows(file_format=ImportFileFormat.XLSX, content=content.getvalue())

    # assert
    assert [row.row_number for row in result.rows] == [2, 4]
    assert result.rows[0].cells[ImportColumn.DATE].value == datetime(2025, 3, 2)
    assert result.rows[0].cells[ImportColumn.AMOUNT].value == 12.5
    assert result.rows[1].cells[ImportColumn.AMOUNT].is_formula


def test_missing_and_repeated_headers_are_reported_together():
    # arrange
    content = ",".join(["Type", " type ", *list(IMPORT_COLUMN_HEADERS.values())[2:]]).encode()

    # act / assert
    with pytest.raises(ImportFileInvalid) as invalid:
        read_rows(file_format=ImportFileFormat.CSV, content=content)

    assert "Repeated column: Type; Missing column: Date" in invalid.value.message


@pytest.mark.parametrize("file_format,content", [(ImportFileFormat.CSV, b"\xff"), (ImportFileFormat.XLSX, b"damaged")])
def test_unreadable_files_are_refused(file_format, content):
    # act / assert
    with pytest.raises(ImportFileInvalid) as invalid:
        read_rows(file_format=file_format, content=content)

    assert "unreadable, damaged, or password-protected" in invalid.value.message


def test_xlsx_requires_transactions_sheet():
    # arrange
    workbook = Workbook()
    content = BytesIO()
    workbook.save(content)

    # act / assert
    with pytest.raises(ImportFileInvalid) as invalid:
        read_rows(file_format=ImportFileFormat.XLSX, content=content.getvalue())

    assert "Missing sheet: Transactions" in invalid.value.message


@pytest.mark.parametrize("row_count", [MAX_IMPORT_ROWS, MAX_IMPORT_ROWS + 1])
def test_row_limit_counts_only_nonempty_records(row_count):
    # arrange
    header = ",".join(IMPORT_COLUMN_HEADERS.values())
    content = (f"{header}\n" + ("expense\n\n" * row_count)).encode()

    # act / assert
    if row_count > MAX_IMPORT_ROWS:
        with pytest.raises(ImportFileInvalid) as invalid:
            read_rows(file_format=ImportFileFormat.CSV, content=content)

        assert "10,000 non-empty rows" in invalid.value.message
    else:
        result = read_rows(file_format=ImportFileFormat.CSV, content=content)
        assert len(result.rows) == row_count


@pytest.mark.parametrize("file_size", [MAX_IMPORT_BYTES, MAX_IMPORT_BYTES + 1])
def test_file_size_limit(file_size):
    # arrange
    header = (",".join(IMPORT_COLUMN_HEADERS.values()) + "\n").encode()
    blocks, remainder = divmod(file_size - len(header), 1000)
    content = header + (b" " * 999 + b"\n") * blocks + b" " * remainder

    # act / assert
    if file_size > MAX_IMPORT_BYTES:
        with pytest.raises(ImportFileInvalid) as invalid:
            read_rows(file_format=ImportFileFormat.CSV, content=content)

        assert "exceeds 5 MB" in invalid.value.message
    else:
        result = read_rows(file_format=ImportFileFormat.CSV, content=content)
        assert result.rows == []
