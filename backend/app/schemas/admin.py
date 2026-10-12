from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import Field

from app.schemas.common import Schema


class AdminUser(Schema):
    id: int
    username: str
    is_admin: bool
    created_at: datetime
    last_seen_at: datetime | None
    workouts: int


class InviteOut(Schema):
    code: str
    note: str | None
    created_at: datetime
    expires_at: datetime
    used_by: str | None = None


class AdminOverview(Schema):
    signup: Literal["open", "invite", "closed"]
    users: list[AdminUser]
    invites: list[InviteOut]


class SignupModeIn(Schema):
    mode: Literal["open", "invite", "closed"]


class InviteIn(Schema):
    days: int = Field(default=7, ge=1, le=90)
    note: str | None = Field(default=None, max_length=80)


class AdminFlagIn(Schema):
    is_admin: bool


class TempPasswordOut(Schema):
    temp_password: str
