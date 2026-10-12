from __future__ import annotations

import enum

from sqlalchemy import JSON, Boolean, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ExerciseKind(str, enum.Enum):
    weight = "weight"   # kg x reps
    reps = "reps"       # bodyweight reps
    time = "time"       # seconds
    assist = "assist"   # assistance kg x reps (lower is harder)


class Exercise(Base):
    """An exercise definition.

    owner_id NULL  -> built-in library entry (shared by everyone, seeded from free-exercise-db)
    owner_id set   -> a user's custom exercise (visible only to that user)
    """
    __tablename__ = "exercises"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(120), nullable=False, unique=True, index=True)
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    kind: Mapped[ExerciseKind] = mapped_column(Enum(ExerciseKind, native_enum=False, length=10), nullable=False)
    equipment: Mapped[str | None] = mapped_column(String(40))
    category: Mapped[str | None] = mapped_column(String(40))
    level: Mapped[str | None] = mapped_column(String(20))
    mechanic: Mapped[str | None] = mapped_column(String(20))
    primary_muscles: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    secondary_muscles: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    instructions: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    images: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
