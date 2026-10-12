from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import Field

from app.schemas.common import Schema


class RegisterIn(Schema):
    username: str = Field(min_length=3, max_length=32, pattern=r"^[A-Za-z0-9_.-]+$")
    password: str = Field(min_length=8, max_length=200)
    invite: str | None = Field(default=None, max_length=32)


class LoginIn(Schema):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=200)


class PasswordChangeIn(Schema):
    current: str = Field(max_length=200)
    new: str = Field(min_length=8, max_length=200)


class PasswordConfirmIn(Schema):
    password: str = Field(max_length=200)


class UserOut(Schema):
    id: int
    username: str
    is_admin: bool


class ConfigOut(Schema):
    version: str
    signup: Literal["open", "invite", "closed"]
    first_user: bool
    exercise_image_base: str


class SettingsIO(Schema):
    start_date: date | None = None
    end_date: date | None = None
    start_weight_kg: float | None = Field(default=None, gt=0, lt=500)
    goal_weight_kg: float | None = Field(default=None, gt=0, lt=500)
    calorie_target: int | None = Field(default=None, ge=0, le=20000)
    protein_target_g: int | None = Field(default=None, ge=0, le=1000)
    step_target: int | None = Field(default=None, ge=0, le=200000)
    cardio_target_min: int | None = Field(default=None, ge=0, le=1440)
    onboarded: bool = False
