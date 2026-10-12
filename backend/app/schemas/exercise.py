from __future__ import annotations

from pydantic import Field

from app.models.exercise import ExerciseKind
from app.schemas.common import Schema


class ExerciseRef(Schema):
    id: int
    slug: str
    name: str
    kind: ExerciseKind


class ExerciseOut(ExerciseRef):
    equipment: str | None = None
    category: str | None = None
    level: str | None = None
    mechanic: str | None = None
    primary_muscles: list[str] = []
    secondary_muscles: list[str] = []
    instructions: list[str] = []
    images: list[str] = []
    custom: bool = False


class ExerciseCreate(Schema):
    name: str = Field(min_length=2, max_length=120)
    kind: ExerciseKind = ExerciseKind.weight
    equipment: str | None = Field(default=None, max_length=40)
    primary_muscles: list[str] = Field(default_factory=list, max_length=6)
    instructions: list[str] = Field(default_factory=list, max_length=20)
