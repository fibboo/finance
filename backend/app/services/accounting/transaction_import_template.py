import csv
from dataclasses import dataclass
from io import BytesIO, StringIO

from openpyxl import Workbook
from openpyxl.styles import Font
from openpyxl.styles.numbers import FORMAT_TEXT
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.worksheet.worksheet import Worksheet

from app.schemas.accounting.transaction import TRANSACTION_TYPE_LABELS, TransactionType
from app.schemas.accounting.transaction_import import IMPORT_COLUMN_HEADERS, ImportColumn, ImportFileFormat

XLSX_MEDIA_TYPE: str = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
CSV_MEDIA_TYPE: str = "text/csv"

_GENERAL_INSTRUCTIONS: tuple[str, ...] = (
    "Only the Transactions sheet is read. Enter one transaction per row and keep the header row.",
    "Use names for accounts, categories, income sources and locations.",
    "Enter Date as YYYY-MM-DD and Income month as YYYY-MM. Enter currencies as codes, such as USD.",
    "Enter positive amounts for expenses, incomes and transfers. Adjustments use a signed Amount.",
    "Use a period for decimals and enter at most two decimal places.",
    "The examples assume USD is your base currency.",
)

_TYPE_INSTRUCTIONS: frozendict[TransactionType, tuple[str, ...]] = frozendict(
    {
        TransactionType.EXPENSE: (
            "Enter the money account in From and the category in To.",
            "Enter the amount and currency debited. For a purchase in another currency, also fill To amount and To currency.",
            'Enter a location name or leave Location blank to use "No location".',
        ),
        TransactionType.INCOME: (
            "Enter the income source in From and the receiving money account in To.",
            "Enter the amount and currency paid, plus the receiving currency in To currency.",
            "If converted, enter the credited amount in To amount.",
            "Enter Base amount when neither currency is the base currency. Fill Income month.",
        ),
        TransactionType.TRANSFER: (
            "Enter the sending money account in From and the receiving money account in To.",
            "Enter the amount and currency withdrawn and the receiving currency in To currency.",
            "Fill To amount only for a cross-currency transfer into a currency other than the base currency.",
            "Record any fee as a separate expense row and exclude it from the transfer amount.",
        ),
        TransactionType.ADJUSTMENT: (
            "Enter the money account in From and leave To blank.",
            "Enter the account's currency in Currency and the signed change in Amount. Use a negative value for a decrease.",
            "Enter Base amount for a foreign-currency account without a rate on that date.",
        ),
    }
)

_EXAMPLE_ROWS: tuple[tuple[str | int | float | None, ...], ...] = (
    (
        TRANSACTION_TYPE_LABELS[TransactionType.EXPENSE],
        "2026-01-05",
        "USD checking",
        "Groceries",
        42.5,
        "USD",
        None,
        None,
        None,
        None,
        "Market",
        "Weekly groceries",
    ),
    (
        TRANSACTION_TYPE_LABELS[TransactionType.EXPENSE],
        "2026-01-06",
        "USD checking",
        "Dining",
        22,
        "USD",
        20,
        "EUR",
        None,
        None,
        None,
        "Lunch abroad",
    ),
    (
        TRANSACTION_TYPE_LABELS[TransactionType.INCOME],
        "2026-01-07",
        "Employer",
        "USD checking",
        2500,
        "USD",
        None,
        "USD",
        None,
        "2026-01",
        None,
        "Salary",
    ),
    (
        TRANSACTION_TYPE_LABELS[TransactionType.INCOME],
        "2026-01-08",
        "Freelance",
        "EUR wallet",
        100,
        "GBP",
        115,
        "EUR",
        128,
        "2026-01",
        None,
        "Converted payment",
    ),
    (
        TRANSACTION_TYPE_LABELS[TransactionType.TRANSFER],
        "2026-01-09",
        "USD checking",
        "USD savings",
        200,
        "USD",
        None,
        "USD",
        None,
        None,
        None,
        "Savings",
    ),
    (
        TRANSACTION_TYPE_LABELS[TransactionType.TRANSFER],
        "2026-01-10",
        "USD checking",
        "EUR wallet",
        110,
        "USD",
        100,
        "EUR",
        None,
        None,
        None,
        "Currency exchange",
    ),
    (
        TRANSACTION_TYPE_LABELS[TransactionType.ADJUSTMENT],
        "2026-01-11",
        "USD checking",
        None,
        10,
        "USD",
        None,
        None,
        None,
        None,
        None,
        "Balance increase",
    ),
    (
        TRANSACTION_TYPE_LABELS[TransactionType.ADJUSTMENT],
        "2026-01-12",
        "USD checking",
        None,
        -5,
        "USD",
        None,
        None,
        None,
        None,
        None,
        "Balance decrease",
    ),
)


@dataclass(frozen=True)
class TransactionImportTemplate:
    content: bytes
    media_type: str
    filename: str


def get_template(*, file_format: ImportFileFormat) -> TransactionImportTemplate:
    headers: tuple[str, ...] = tuple(IMPORT_COLUMN_HEADERS.values())
    if file_format is ImportFileFormat.CSV:
        with StringIO(newline="") as csv_file:
            csv.writer(csv_file).writerow(headers)
            content: bytes = csv_file.getvalue().encode("utf-8-sig")

        media_type: str = CSV_MEDIA_TYPE
    else:
        workbook = Workbook()
        transactions: Worksheet = workbook.active
        transactions.title = "Transactions"
        instructions: Worksheet = workbook.create_sheet("Instructions")
        examples: Worksheet = workbook.create_sheet("Examples")
        _write_table_header(sheet=transactions, headers=headers)
        _write_table_header(sheet=examples, headers=headers)
        _add_type_validation(sheet=transactions)
        _write_instructions(sheet=instructions)

        for row in _EXAMPLE_ROWS:
            examples.append(row)

        with BytesIO() as xlsx_file:
            workbook.save(xlsx_file)
            content = xlsx_file.getvalue()

        media_type = XLSX_MEDIA_TYPE

    template = TransactionImportTemplate(
        content=content, media_type=media_type, filename=f"transactions-template.{file_format.value.lower()}"
    )
    return template


def _write_table_header(*, sheet: Worksheet, headers: tuple[str, ...]) -> None:
    sheet.append(headers)
    sheet.freeze_panes = "A2"
    for column in sheet[1]:
        column.font = Font(bold=True)

    for index, import_column in enumerate(IMPORT_COLUMN_HEADERS, start=1):
        dimension = sheet.column_dimensions[get_column_letter(index)]
        dimension.width = 20
        if import_column in (ImportColumn.DATE, ImportColumn.INCOME_MONTH):
            dimension.number_format = FORMAT_TEXT


def _add_type_validation(*, sheet: Worksheet) -> None:
    type_column: str = get_column_letter(tuple(IMPORT_COLUMN_HEADERS).index(ImportColumn.TYPE) + 1)
    labels: str = ",".join(TRANSACTION_TYPE_LABELS.values())
    validation = DataValidation(type="list", formula1=f'"{labels}"', allow_blank=True, showErrorMessage=True)
    validation.add(f"{type_column}2:{type_column}1048576")
    sheet.add_data_validation(validation)


def _write_instructions(*, sheet: Worksheet) -> None:
    sheet.column_dimensions["A"].width = 132
    for instruction in _GENERAL_INSTRUCTIONS:
        sheet.append([instruction])

    for transaction_type, instructions in _TYPE_INSTRUCTIONS.items():
        sheet.append([])
        sheet.append([TRANSACTION_TYPE_LABELS[transaction_type]])
        sheet.cell(row=sheet.max_row, column=1).font = Font(bold=True)
        for instruction in instructions:
            sheet.append([instruction])
