from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, UploadFile
from fastapi_pagination import Page
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app.api import transaction_import_responses
from app.api.deps import DbTransaction, get_db, get_onboarded_user_id, get_user_id
from app.schemas.accounting.transaction_import import (
    ImportFileFormat,
    TransactionImport,
    TransactionImportRow,
    TransactionImportRowsRequest,
)
from app.services.accounting import transaction_import_service, transaction_import_template
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
    response: Response = transaction_import_responses.build_template_response(template=template)
    return response


@router.post("", status_code=status.HTTP_201_CREATED)
async def upload_transaction_import(
    *, db: DbTransaction, file: UploadFile, user_id: UUID = Depends(get_onboarded_user_id)
) -> TransactionImport:
    """Upload an XLSX or CSV file and store its validated rows for review."""
    transaction_import: TransactionImport = await transaction_import_service.upload(db=db, user_id=user_id, file=file)
    return transaction_import


@router.get("/current")
async def get_current_transaction_import(
    *, db: AsyncSession = Depends(get_db), user_id: UUID = Depends(get_user_id)
) -> TransactionImport:
    """Get the signed-in user's open transaction import."""
    transaction_import: TransactionImport = await transaction_import_service.get_current(db=db, user_id=user_id)
    return transaction_import


@router.get("/{import_id}")
async def get_transaction_import(
    *, import_id: UUID, db: AsyncSession = Depends(get_db), user_id: UUID = Depends(get_user_id)
) -> TransactionImport:
    """Get a transaction import by id."""
    transaction_import: TransactionImport = await transaction_import_service.get_import(
        db=db, user_id=user_id, import_id=import_id
    )
    return transaction_import


@router.get("/{import_id}/rows")
async def get_transaction_import_rows(
    *,
    import_id: UUID,
    request: Annotated[TransactionImportRowsRequest, Query()],
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_user_id),
) -> Page[TransactionImportRow]:
    """List the rows of a transaction import in file order, optionally filtered by validation errors."""
    rows: Page[TransactionImportRow] = await transaction_import_service.get_rows(
        db=db, user_id=user_id, import_id=import_id, request=request
    )
    return rows


@router.get(
    "/{import_id}/report",
    response_class=Response,
    responses={200: {"content": {transaction_import_template.CSV_MEDIA_TYPE: {"schema": {"type": "string"}}}}},
)
async def get_transaction_import_report(
    *, import_id: UUID, db: AsyncSession = Depends(get_db), user_id: UUID = Depends(get_user_id)
) -> Response:
    """Download a CSV report of the validation errors in a transaction import."""
    report: str = await transaction_import_service.get_report(db=db, user_id=user_id, import_id=import_id)
    response: Response = transaction_import_responses.build_report_response(report=report)
    return response


@router.delete("/{import_id}")
async def discard_transaction_import(
    *, db: DbTransaction, import_id: UUID, user_id: UUID = Depends(get_user_id)
) -> TransactionImport:
    """Cancel a transaction import that is in review."""
    transaction_import: TransactionImport = await transaction_import_service.discard(
        db=db, user_id=user_id, import_id=import_id
    )
    return transaction_import
