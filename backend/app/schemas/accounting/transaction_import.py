from enum import StrEnum


class ImportFileFormat(StrEnum):
    XLSX = "XLSX"
    CSV = "CSV"


class ImportColumn(StrEnum):
    TYPE = "TYPE"
    DATE = "DATE"
    FROM = "FROM"
    TO = "TO"
    AMOUNT = "AMOUNT"
    CURRENCY = "CURRENCY"
    TO_AMOUNT = "TO_AMOUNT"
    TO_CURRENCY = "TO_CURRENCY"
    BASE_AMOUNT = "BASE_AMOUNT"
    INCOME_MONTH = "INCOME_MONTH"
    LOCATION = "LOCATION"
    COMMENT = "COMMENT"


IMPORT_COLUMN_HEADERS: frozendict[ImportColumn, str] = frozendict(
    {
        ImportColumn.TYPE: "Type",
        ImportColumn.DATE: "Date",
        ImportColumn.FROM: "From",
        ImportColumn.TO: "To",
        ImportColumn.AMOUNT: "Amount",
        ImportColumn.CURRENCY: "Currency",
        ImportColumn.TO_AMOUNT: "To amount",
        ImportColumn.TO_CURRENCY: "To currency",
        ImportColumn.BASE_AMOUNT: "Base amount",
        ImportColumn.INCOME_MONTH: "Income month",
        ImportColumn.LOCATION: "Location",
        ImportColumn.COMMENT: "Comment",
    }
)
