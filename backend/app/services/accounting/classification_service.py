from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.logging_settings import get_logger
from app.crud.accounting.account import account_crud
from app.crud.accounting.classification import classification_crud
from app.crud.user.user import user_crud
from app.exceptions.conflict_409 import (
    ClassificationReplacementRequired,
    ConflictException,
    IntegrityException,
    NameAlreadyExists,
)
from app.exceptions.not_fount_404 import EntityNotFound
from app.exceptions.unprocessable_422 import AccountClassificationNotAllowed, InvalidClassificationReplacement
from app.models.accounting.account import Account as AccountModel, MONEY_ACCOUNT_UNIQUE_NAME_INDEX
from app.models.accounting.classification import Classification as ClassificationModel, CLASSIFICATION_UNIQUE_NAME_INDEX
from app.models.user.user import User as UserModel
from app.schemas.accounting.account import AccountKind
from app.schemas.accounting.classification import Classification, ClassificationKind, ClassificationNameRequest

logger = get_logger(logger_name=__name__)

DEFAULT_CLASSIFICATION_NAMES: frozendict[ClassificationKind, str] = frozendict(
    {
        ClassificationKind.MONEY_ACCOUNT: "Asset",
        ClassificationKind.EXPENSE_CATEGORY: "Variable",
    }
)


def get_classification_kind(*, account_kind: AccountKind) -> ClassificationKind | None:
    if account_kind == AccountKind.ASSET:
        return ClassificationKind.MONEY_ACCOUNT

    if account_kind == AccountKind.EXPENSE:
        return ClassificationKind.EXPENSE_CATEGORY

    return None


async def lock_classifications(*, db: AsyncSession, user_id: UUID) -> None:
    users_db: dict[UUID, UserModel] = await user_crud.get_locked_by_ids(db=db, ids=[user_id])
    if user_id not in users_db:
        raise EntityNotFound(entity=UserModel, search_params={"id": user_id}, logger=logger)


async def ensure_defaults(*, db: AsyncSession, user_id: UUID) -> dict[ClassificationKind, UUID]:
    defaults_db: list[ClassificationModel] = await classification_crud.get_batch(
        db=db, user_id=user_id, is_default=True
    )
    default_ids: dict[ClassificationKind, UUID] = {
        classification.kind: classification.id for classification in defaults_db
    }
    missing_defaults: list[dict] = []
    for kind, name in DEFAULT_CLASSIFICATION_NAMES.items():
        if kind not in default_ids:
            missing_defaults.append({"user_id": user_id, "kind": kind, "name": name, "is_default": True})

    if len(missing_defaults) > 0:
        created_defaults: list[ClassificationModel] = await classification_crud.create_batch(
            db=db, objs_in=missing_defaults
        )
        default_ids.update({classification.kind: classification.id for classification in created_defaults})

    return default_ids


async def get_classification_id(
    *, db: AsyncSession, user_id: UUID, account_kind: AccountKind, classification_id: UUID | None
) -> UUID | None:
    kind: ClassificationKind | None = get_classification_kind(account_kind=account_kind)
    if kind is None:
        if classification_id is not None:
            raise AccountClassificationNotAllowed(account_kind=account_kind, logger=logger)

        return None

    if classification_id is None:
        default_ids: dict[ClassificationKind, UUID] = await ensure_defaults(db=db, user_id=user_id)
        return default_ids[kind]

    await _get_classification(db=db, user_id=user_id, kind=kind, classification_id=classification_id)
    return classification_id


async def _get_classification(
    *, db: AsyncSession, user_id: UUID, kind: ClassificationKind, classification_id: UUID
) -> ClassificationModel:
    classification_db: ClassificationModel | None = await classification_crud.get_or_none(
        db=db, user_id=user_id, kind=kind, id=classification_id
    )
    if classification_db is None:
        raise EntityNotFound(
            entity=ClassificationModel, search_params={"id": classification_id, "kind": kind}, logger=logger
        )

    return classification_db


def _get_integrity_exception(*, exception: IntegrityError, user_id: UUID) -> ConflictException:
    if exception.driver_exception.constraint_name == CLASSIFICATION_UNIQUE_NAME_INDEX:
        name_exception = NameAlreadyExists(entity=ClassificationModel, user_id=user_id, logger=logger)
        return name_exception

    if exception.driver_exception.constraint_name == MONEY_ACCOUNT_UNIQUE_NAME_INDEX:
        account_name_exception = NameAlreadyExists(entity=AccountModel, user_id=user_id, logger=logger)
        return account_name_exception

    integrity_exception = IntegrityException(entity=ClassificationModel, exception=exception, logger=logger)
    return integrity_exception


async def get_classifications(*, db: AsyncSession, user_id: UUID, kind: ClassificationKind) -> list[Classification]:
    classifications_db: list[ClassificationModel] = await classification_crud.get_user_classifications(
        db=db, user_id=user_id, kind=kind
    )
    classifications: list[Classification] = [
        Classification.model_validate(classification_db) for classification_db in classifications_db
    ]
    return classifications


async def create_classification(
    *, db: AsyncSession, user_id: UUID, kind: ClassificationKind, create_data: ClassificationNameRequest
) -> Classification:
    await lock_classifications(db=db, user_id=user_id)
    try:
        classification_db: ClassificationModel = await classification_crud.create(
            db=db, obj_in={"user_id": user_id, "kind": kind, "name": create_data.name}
        )
    except IntegrityError as exc:
        raise _get_integrity_exception(exception=exc, user_id=user_id)

    classification: Classification = Classification.model_validate(classification_db)
    return classification


async def rename_classification(
    *,
    db: AsyncSession,
    user_id: UUID,
    kind: ClassificationKind,
    classification_id: UUID,
    update_data: ClassificationNameRequest,
) -> Classification:
    await lock_classifications(db=db, user_id=user_id)
    try:
        classification_db: ClassificationModel | None = await classification_crud.update_orm(
            db=db, obj_in=update_data, user_id=user_id, kind=kind, id=classification_id
        )
    except IntegrityError as exc:
        raise _get_integrity_exception(exception=exc, user_id=user_id)

    if classification_db is None:
        raise EntityNotFound(
            entity=ClassificationModel, search_params={"id": classification_id, "kind": kind}, logger=logger
        )

    classification: Classification = Classification.model_validate(classification_db)
    return classification


async def delete_classification(
    *, db: AsyncSession, user_id: UUID, kind: ClassificationKind, classification_id: UUID, replacement_id: UUID | None
) -> None:
    await lock_classifications(db=db, user_id=user_id)
    classification_db: ClassificationModel = await _get_classification(
        db=db, user_id=user_id, kind=kind, classification_id=classification_id
    )
    has_assignments: bool = await account_crud.has_classification_assignments(
        db=db, classification_id=classification_id
    )
    if replacement_id is None and (classification_db.is_default or has_assignments):
        raise ClassificationReplacementRequired(classification_id=classification_id, logger=logger)

    if replacement_id is not None:
        if replacement_id == classification_id:
            raise InvalidClassificationReplacement(classification_id=classification_id, logger=logger)

        await _get_classification(db=db, user_id=user_id, kind=kind, classification_id=replacement_id)
        if has_assignments:
            try:
                await account_crud.replace_classification(
                    db=db, classification_id=classification_id, replacement_id=replacement_id
                )
            except IntegrityError as exc:
                raise _get_integrity_exception(exception=exc, user_id=user_id)

    await classification_crud.delete_by_ids(db=db, ids=[classification_id])
    if classification_db.is_default:
        await classification_crud.update_orm(db=db, obj_in={"is_default": True}, id=replacement_id)
