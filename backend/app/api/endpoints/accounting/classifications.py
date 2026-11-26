from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DbTransaction, get_db, get_user_id
from app.schemas.accounting.classification import Classification, ClassificationKind, ClassificationNameRequest
from app.services.accounting import classification_service

router = APIRouter()


@router.get("/{kind}")
async def get_classifications(
    *, kind: ClassificationKind, user_id: UUID = Depends(get_user_id), db: AsyncSession = Depends(get_db)
) -> list[Classification]:
    classifications: list[Classification] = await classification_service.get_classifications(
        db=db, user_id=user_id, kind=kind
    )
    return classifications


@router.post("/{kind}", status_code=201)
async def create_classification(
    *,
    kind: ClassificationKind,
    create_data: ClassificationNameRequest,
    user_id: UUID = Depends(get_user_id),
    db: DbTransaction,
) -> Classification:
    classification: Classification = await classification_service.create_classification(
        db=db, user_id=user_id, kind=kind, create_data=create_data
    )
    return classification


@router.put("/{kind}/{classification_id}")
async def rename_classification(
    *,
    kind: ClassificationKind,
    classification_id: UUID,
    update_data: ClassificationNameRequest,
    user_id: UUID = Depends(get_user_id),
    db: DbTransaction,
) -> Classification:
    classification: Classification = await classification_service.rename_classification(
        db=db, user_id=user_id, kind=kind, classification_id=classification_id, update_data=update_data
    )
    return classification


@router.delete("/{kind}/{classification_id}", status_code=204)
async def delete_classification(
    *,
    kind: ClassificationKind,
    classification_id: UUID,
    replacement_id: UUID | None = None,
    user_id: UUID = Depends(get_user_id),
    db: DbTransaction,
) -> None:
    """Move all assignments to a replacement when deleting a type in use. A replacement for the default becomes the default."""
    await classification_service.delete_classification(
        db=db, user_id=user_id, kind=kind, classification_id=classification_id, replacement_id=replacement_id
    )
