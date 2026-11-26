from uuid import UUID

from sqlalchemy import Boolean, Enum, ForeignKey, func, Index, String, text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as DB_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.schemas.accounting.classification import ClassificationKind

CLASSIFICATION_UNIQUE_NAME_INDEX = "classification_unique_user_kind_name"


class Classification(Base):
    __tablename__ = "classifications"
    __table_args__ = (UniqueConstraint("user_id", "id"),)

    id: Mapped[UUID] = mapped_column(DB_UUID, primary_key=True, server_default=func.uuidv7(monotonic=True))
    user_id: Mapped[UUID] = mapped_column(DB_UUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    kind: Mapped[ClassificationKind] = mapped_column(
        Enum(ClassificationKind, native_enum=False, validate_strings=True), nullable=False
    )
    name: Mapped[str] = mapped_column(String(32), nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")


Index(
    CLASSIFICATION_UNIQUE_NAME_INDEX,
    Classification.user_id,
    Classification.kind,
    func.lower(Classification.name),
    unique=True,
)
Index(
    "classification_unique_user_kind_default",
    Classification.user_id,
    Classification.kind,
    unique=True,
    postgresql_where=text("is_default"),
)
