from __future__ import annotations

from typing import Literal

from pydantic import Field

from app.schemas.common import Schema
from app.schemas.exercise import ExerciseRef

Color = Literal["push", "pull", "legs", "other"]


class RoutineExerciseIn(Schema):
    exercise_id: int
    alt_exercise_id: int | None = None
    sets: int = Field(default=3, ge=1, le=20)
    reps: str = Field(default="8-12", max_length=16)
    rest_seconds: int = Field(default=90, ge=0, le=900)


class RoutineIn(Schema):
    name: str = Field(min_length=1, max_length=60)
    focus: str = Field(default="", max_length=120)
    color: Color = "other"
    exercises: list[RoutineExerciseIn] = Field(default_factory=list, max_length=30)


class RoutineExerciseOut(Schema):
    id: int
    exercise: ExerciseRef
    alt_exercise: ExerciseRef | None = None
    sets: int
    reps: str
    rest_seconds: int


class RoutineOut(Schema):
    id: int
    name: str
    focus: str
    color: Color
    position: int
    exercises: list[RoutineExerciseOut]


class ScheduleIO(Schema):
    """Routine id per weekday, Monday first. null = rest day."""
    days: list[int | None] = Field(min_length=7, max_length=7)


class TemplateOut(Schema):
    key: str
    name: str
    description: str
    days_per_week: int


class ReorderIn(Schema):
    ids: list[int]
