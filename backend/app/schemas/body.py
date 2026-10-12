from __future__ import annotations

from datetime import date

from pydantic import Field

from app.schemas.common import Schema


class BodyLogIn(Schema):
    weight_kg: float | None = Field(default=None, gt=0, lt=500)
    calories: int | None = Field(default=None, ge=0, le=20000)
    protein_g: int | None = Field(default=None, ge=0, le=1000)
    steps: int | None = Field(default=None, ge=0, le=200000)
    cardio_min: int | None = Field(default=None, ge=0, le=1440)
    sleep_h: float | None = Field(default=None, ge=0, le=24)
    waist_cm: float | None = Field(default=None, gt=0, lt=400)
    body_fat_pct: float | None = Field(default=None, ge=1, le=80)
    note: str | None = Field(default=None, max_length=500)


class BodyLogOut(BodyLogIn):
    date: date
