from __future__ import annotations

from datetime import date, datetime

from pydantic import Field

from app.schemas.common import Schema
from app.schemas.exercise import ExerciseRef
from app.schemas.routine import Color


class SetIO(Schema):
    weight_kg: float | None = Field(default=None, ge=-500, le=2000)
    reps: int | None = Field(default=None, ge=0, le=10000)
    rir: int | None = Field(default=None, ge=0, le=10)
    done: bool = False


class WorkoutExerciseIn(Schema):
    exercise_id: int
    swap_exercise_id: int | None = None
    target_reps: str = Field(default="", max_length=16)
    rest_seconds: int = Field(default=90, ge=0, le=900)
    note: str | None = Field(default=None, max_length=500)
    sets: list[SetIO] = Field(default_factory=list, max_length=30)


class WorkoutIn(Schema):
    routine_id: int | None = None
    name: str = Field(min_length=1, max_length=60)
    color: Color = "other"
    notes: str | None = Field(default=None, max_length=2000)
    started_at: datetime | None = None
    finished_at: datetime | None = None
    exercises: list[WorkoutExerciseIn] = Field(default_factory=list, max_length=40)


class WorkoutExerciseOut(Schema):
    id: int
    exercise: ExerciseRef
    swap_exercise: ExerciseRef | None = None
    target_reps: str
    rest_seconds: int
    note: str | None = None
    sets: list[SetIO]


class WorkoutOut(Schema):
    id: int
    date: date
    routine_id: int | None
    name: str
    color: Color
    notes: str | None
    started_at: datetime | None
    finished_at: datetime | None
    exercises: list[WorkoutExerciseOut]


class WorkoutSummary(Schema):
    date: date
    name: str
    color: Color
    sets_done: int
    sets_total: int
    volume_kg: float
    pr_count: int
    finished: bool


class PreviousSets(Schema):
    date: date
    sets: list[SetIO]


class ExerciseContext(Schema):
    """What the logger needs for one exercise: the last session's sets and the best e1RM before a date."""
    exercise_id: int
    previous: PreviousSets | None = None
    best_e1rm: float | None = Field(default=None, alias="bestE1rm")


class HistoryPoint(Schema):
    date: date
    sets: list[SetIO]
    top_kg: float | None
    volume_kg: float
    e1rm: float | None
