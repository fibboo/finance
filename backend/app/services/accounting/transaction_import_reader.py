import csv
from collections import Counter
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from io import BytesIO, StringIO
from xml.etree.ElementTree import ParseError
from zipfile import BadZipFile, ZipFile
from zlib import error as CompressionError

from openpyxl import load_workbook
from openpyxl.cell.read_only import EmptyCell, ReadOnlyCell
from openpyxl.utils.exceptions import InvalidFileException

from app.configs.logging_settings import get_logger
from app.exceptions.unprocessable_422 import ImportFileInvalid
from app.schemas.accounting.transaction_import import (
    IMPORT_COLUMN_HEADERS,
    ImportColumn,
    ImportFileFormat,
    TRANSACTIONS_SHEET,
)

MAX_IMPORT_BYTES: int = 5 * 1024 * 1024
MAX_IMPORT_ROWS: int = 10_000
_MAX_XLSX_EXPANDED_BYTES: int = 64 * 1024 * 1024
_KNOWN_HEADERS: frozendict[str, ImportColumn] = frozendict(
    {header.casefold(): column for column, header in IMPORT_COLUMN_HEADERS.items()}
)

logger = get_logger(logger_name=__name__)

type CellValue = str | int | float | bool | date | datetime | time | timedelta | None


@dataclass(frozen=True)
class RawCell:
    value: CellValue
    is_formula: bool = False


@dataclass(frozen=True)
class RawRow:
    row_number: int
    cells: dict[ImportColumn, RawCell]


@dataclass(frozen=True)
class ImportFileRows:
    headers: tuple[str, ...]
    ignored_columns: list[str]
    rows: list[RawRow]


def read_rows(*, file_format: ImportFileFormat, content: bytes) -> ImportFileRows:
    if len(content) > MAX_IMPORT_BYTES:
        raise ImportFileInvalid(problems=["The file exceeds 5 MB"], logger=logger)

    records: Iterator[tuple[int, tuple[RawCell, ...]]]
    if file_format is ImportFileFormat.CSV:
        records = _csv_records(content=content)
    else:
        records = _xlsx_records(content=content)

    problems: list[str] = []
    rows: list[RawRow] = []
    try:
        _, header_cells = next(records, (1, ()))
        headers: tuple[str, ...] = tuple(
            str(cell.value).strip() if cell.value is not None else "" for cell in header_cells
        )
        header_counts = Counter(header.casefold() for header in headers)
        for header in IMPORT_COLUMN_HEADERS.values():
            count: int = header_counts[header.casefold()]
            if count == 0:
                problems.append(f"Missing column: {header}")
            elif count > 1:
                problems.append(f"Repeated column: {header}")

        known_columns: dict[int, ImportColumn] = {}
        ignored_columns: list[str] = []
        for index, header in enumerate(headers):
            column: ImportColumn | None = _KNOWN_HEADERS.get(header.casefold())
            if column is not None:
                known_columns[index] = column
            elif len(header) > 0:
                ignored_columns.append(header)

        for row_number, cells in records:
            if all(cell.value is None or isinstance(cell.value, str) and cell.value.strip() == "" for cell in cells):
                continue
            if len(rows) == MAX_IMPORT_ROWS:
                problems.append(f"The file exceeds {MAX_IMPORT_ROWS:,} non-empty rows")
                break

            values: dict[ImportColumn, RawCell] = {
                column: cells[index] for index, column in known_columns.items() if index < len(cells)
            }
            rows.append(RawRow(row_number=row_number, cells=values))
    except (
        BadZipFile,
        CompressionError,
        csv.Error,
        InvalidFileException,
        KeyError,
        OSError,
        ParseError,
        ValueError,
        RuntimeError,
    ):
        problems.append("The file is unreadable, damaged, or password-protected")
    finally:
        records.close()

    if len(problems) > 0:
        raise ImportFileInvalid(problems=problems, logger=logger)

    result = ImportFileRows(headers=headers, ignored_columns=ignored_columns, rows=rows)
    return result


def _csv_records(*, content: bytes) -> Iterator[tuple[int, tuple[RawCell, ...]]]:
    if b"\x00" in content:
        raise ImportFileInvalid(problems=["The CSV contains a NUL character"], logger=logger)

    with StringIO(content.decode("utf-8-sig"), newline="") as stream:
        delimiter: str = ","
        best_header_matches: int = -1
        for candidate in (",", ";"):
            header: list[str] = next(csv.reader(stream, delimiter=candidate), [])
            matches: int = sum(cell.strip().casefold() in _KNOWN_HEADERS for cell in header)
            if matches > best_header_matches:
                delimiter = candidate
                best_header_matches = matches
            stream.seek(0)

        reader = csv.reader(stream, delimiter=delimiter, strict=True)
        while True:
            row_number: int = reader.line_num + 1
            row: list[str] | None = next(reader, None)
            if row is None:
                break
            cells: tuple[RawCell, ...] = tuple(
                RawCell(value=value, is_formula=value.lstrip().startswith("=")) for value in row
            )
            yield row_number, cells


def _xlsx_records(*, content: bytes) -> Iterator[tuple[int, tuple[RawCell, ...]]]:
    with ZipFile(BytesIO(content)) as archive:
        entries = archive.infolist()
        if any(entry.flag_bits & 1 for entry in entries):
            raise ImportFileInvalid(problems=["The XLSX is password-protected"], logger=logger)
        if sum(entry.file_size for entry in entries) > _MAX_XLSX_EXPANDED_BYTES:
            raise ImportFileInvalid(problems=["The expanded XLSX is too large"], logger=logger)

    with BytesIO(content) as stream:
        workbook = load_workbook(stream, read_only=True, data_only=False, keep_links=False)
        try:
            if TRANSACTIONS_SHEET not in workbook.sheetnames:
                raise ImportFileInvalid(problems=[f"Missing sheet: {TRANSACTIONS_SHEET}"], logger=logger)

            sheet = workbook[TRANSACTIONS_SHEET]
            sheet.reset_dimensions()
            for row_number, row in enumerate(sheet.iter_rows(), start=1):
                if row_number > 1_048_576:
                    raise ImportFileInvalid(problems=["The XLSX contains an invalid row number"], logger=logger)

                cells: tuple[RawCell, ...] = tuple(_xlsx_cell(cell=cell) for cell in row)
                yield row_number, cells
        finally:
            workbook.close()


def _xlsx_cell(*, cell: ReadOnlyCell | EmptyCell) -> RawCell:
    result = RawCell(value=cell.value, is_formula=cell.data_type == "f")
    return result
