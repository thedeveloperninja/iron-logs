from __future__ import annotations

from datetime import UTC, datetime

from fastapi import HTTPException


def utcnow() -> datetime:
    return datetime.now(UTC)


def as_utc(dt: datetime | None) -> datetime | None:
    """SQLite hands back naive datetimes; treat them as UTC."""
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def not_found(what: str = "Not found.") -> HTTPException:
    return HTTPException(404, what)


def bad_request(msg: str) -> HTTPException:
    return HTTPException(400, msg)


def e1rm(weight: float, reps: int) -> float:
    """Epley estimated one-rep max."""
    return weight * (1 + reps / 30) if reps > 1 else weight
