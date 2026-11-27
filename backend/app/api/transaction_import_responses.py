from fastapi import Response

from app.services.accounting.transaction_import_template import TransactionImportTemplate


def build_template_response(*, template: TransactionImportTemplate) -> Response:
    response = Response(
        content=template.content,
        media_type=template.media_type,
        headers={"Content-Disposition": f'attachment; filename="{template.filename}"'},
    )
    return response
