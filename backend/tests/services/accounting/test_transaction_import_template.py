from io import BytesIO

from openpyxl import load_workbook
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.worksheet.worksheet import Worksheet

from app.schemas.accounting.transaction_import import ImportFileFormat
from app.services.accounting.transaction_import_template import get_template, TransactionImportTemplate


def test_get_csv_template_contains_only_utf8_bom_and_header() -> None:
    # act
    template: TransactionImportTemplate = get_template(file_format=ImportFileFormat.CSV)

    # assert
    assert template.filename == "transactions-template.csv"
    assert template.media_type == "text/csv"
    assert template.content == (
        b"\xef\xbb\xbfType,Date,From,To,Amount,Currency,To amount,To currency,Base amount,Income month,Location,Comment\r\n"
    )


def test_get_xlsx_template_keeps_transaction_sheet_ready_for_entry() -> None:
    # act
    template: TransactionImportTemplate = get_template(file_format=ImportFileFormat.XLSX)

    # assert
    assert template.filename == "transactions-template.xlsx"
    assert template.media_type == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    workbook = load_workbook(BytesIO(template.content))
    assert workbook.sheetnames == ["Transactions", "Instructions", "Examples"]
    transactions: Worksheet = workbook["Transactions"]
    assert list(transactions.values) == [
        (
            "Type",
            "Date",
            "From",
            "To",
            "Amount",
            "Currency",
            "To amount",
            "To currency",
            "Base amount",
            "Income month",
            "Location",
            "Comment",
        )
    ]
    assert all(cell.font.bold for cell in transactions[1])
    assert transactions.freeze_panes == "A2"
    assert transactions.column_dimensions["B"].number_format == "@"
    assert transactions.column_dimensions["J"].number_format == "@"
    validation: DataValidation
    (validation,) = transactions.data_validations.dataValidation
    assert validation.type == "list"
    assert validation.formula1 == '"Expense,Income,Transfer,Adjustment"'
    assert "A2" in validation
    assert "A10001" in validation
    assert "A1" not in validation
    assert "B2" not in validation


def test_get_xlsx_template_includes_every_import_example() -> None:
    # act
    template: TransactionImportTemplate = get_template(file_format=ImportFileFormat.XLSX)

    # assert
    workbook = load_workbook(BytesIO(template.content))
    examples: Worksheet = workbook["Examples"]
    assert [cell.value for cell in examples[1]] == [cell.value for cell in workbook["Transactions"][1]]
    example_cases: list[tuple] = []
    for row in examples.iter_rows(min_row=2, values_only=True):
        kind, _, _, _, amount, currency, to_amount, to_currency, base_amount, income_month, location, _ = row
        example_cases.append((kind, amount, currency, to_amount, to_currency, base_amount, income_month, location))

    assert example_cases == [
        ("Expense", 42.5, "USD", None, None, None, None, "Market"),
        ("Expense", 22, "USD", 20, "EUR", None, None, None),
        ("Income", 2500, "USD", None, "USD", None, "2026-01", None),
        ("Income", 100, "GBP", 115, "EUR", 128, "2026-01", None),
        ("Transfer", 200, "USD", None, "USD", None, None, None),
        ("Transfer", 110, "USD", 100, "EUR", None, None, None),
        ("Adjustment", 10, "USD", None, None, None, None, None),
        ("Adjustment", -5, "USD", None, None, None, None, None),
    ]

    instructions: Worksheet = workbook["Instructions"]
    instruction_headings: list[str] = [cell.value for cell in instructions["A"] if cell.font.bold]
    assert instruction_headings == ["Expense", "Income", "Transfer", "Adjustment"]
