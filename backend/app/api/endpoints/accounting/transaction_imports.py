from uuid import UUID

from fastapi import APIRouter, Depends, Response

from app.api.deps import get_user_id
from app.schemas.accounting.transaction_import import ImportFileFormat
from app.services.accounting import transaction_import_template
from app.services.accounting.transaction_import_template import TransactionImportTemplate

router = APIRouter()


@router.get(
    "/template",
    response_class=Response,
    responses={
        200: {
            "content": {
                transaction_import_template.XLSX_MEDIA_TYPE: {"schema": {"type": "string", "format": "binary"}},
                transaction_import_template.CSV_MEDIA_TYPE: {"schema": {"type": "string"}},
            },
        }
    },
)
def get_transaction_import_template(*, file_format: ImportFileFormat, user_id: UUID = Depends(get_user_id)) -> Response:
    """Download the transaction import template in XLSX or CSV format."""
    template: TransactionImportTemplate = transaction_import_template.get_template(file_format=file_format)
    response = Response(
        content=template.content,
        media_type=template.media_type,
        headers={"Content-Disposition": f'attachment; filename="{template.filename}"'},
    )
    return response
