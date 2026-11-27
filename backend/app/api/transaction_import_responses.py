from fastapi import Response

from app.services.accounting import transaction_import_template
from app.services.accounting.transaction_import_template import TransactionImportTemplate


def build_template_response(*, template: TransactionImportTemplate) -> Response:
    response = Response(
        content=template.content,
        media_type=template.media_type,
        headers={"Content-Disposition": f'attachment; filename="{template.filename}"'},
    )
    return response


def build_report_response(*, report: str) -> Response:
    response = Response(
        content=report.encode("utf-8-sig"),
        media_type=transaction_import_template.CSV_MEDIA_TYPE,
        headers={"Content-Disposition": 'attachment; filename="transaction-import-report.csv"'},
    )
    return response
