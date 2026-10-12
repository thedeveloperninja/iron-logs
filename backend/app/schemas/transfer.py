"""Portable JSON export format (version 1).

Exercises are referenced by a key instead of a database id, so an export
can be imported on another Iron Log server:
  "lib:<slug>"       built-in library exercise
  "custom:<name>"    one of the user's custom exercises (included in the file)
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import Field

from app.models.exercise import ExerciseKind
from app.schemas.auth import SettingsIO
from app.schemas.body import BodyLogOut
from app.schemas.common import Schema
from app.schemas.routine import Color
from app.schemas.workout import SetIO


class XCustomExercise(Schema):
    name: str = Field(min_length=2, max_length=120)
    kind: ExerciseKind = ExerciseKind.weight
    equipment: str | None = None
    primary_muscles: list[str] = []
    instructions: list[str] = []


class XRoutineExercise(Schema):
    exercise: str
    alt: str | None = None
    sets: int = Field(default=3, ge=1, le=20)
    reps: str = Field(default="8-12", max_length=16)
    rest_seconds: int = Field(default=90, ge=0, le=900)


class XRoutine(Schema):
    key: str
    name: str = Field(min_length=1, max_length=60)
    focus: str = ""
    color: Color = "other"
    exercises: list[XRoutineExercise] = []


class XWorkoutExercise(Schema):
    exercise: str
    swap: str | None = None
    target_reps: str = ""
    rest_seconds: int = 90
    note: str | None = None
    sets: list[SetIO] = []


class XWorkout(Schema):
    date: date
    routine: str | None = None
    name: str
    color: Color = "other"
    notes: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    exercises: list[XWorkoutExercise] = []


class ExportV1(Schema):
    app: Literal["iron-log"] = "iron-log"
    version: int = 1
    exported_at: datetime | None = None
    username: str | None = None
    settings: SettingsIO | None = None
    custom_exercises: list[XCustomExercise] = []
    routines: list[XRoutine] = []
    schedule: list[str | None] = Field(default_factory=lambda: [None] * 7, min_length=7, max_length=7)
    workouts: list[XWorkout] = Field(default_factory=list, max_length=20000)
    body_logs: list[BodyLogOut] = Field(default_factory=list, max_length=20000)


class ImportResult(Schema):
    mode: Literal["merge", "replace"]
    workouts: int
    body_logs: int
    routines: int
    custom_exercises: int
    skipped: list[str] = []
