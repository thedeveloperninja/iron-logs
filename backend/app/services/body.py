from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import BodyLog
from app.schemas.body import BodyLogIn


def list_logs(db: Session, user_id: int, start: date | None, end: date | None) -> list[BodyLog]:
    q = select(BodyLog).where(BodyLog.user_id == user_id).order_by(BodyLog.date)
    if start:
        q = q.where(BodyLog.date >= start)
    if end:
        q = q.where(BodyLog.date <= end)
    return list(db.scalars(q))


def upsert(db: Session, user_id: int, d: date, data: BodyLogIn) -> BodyLog | None:
    """Save the day's log. A log with every field empty is deleted instead."""
    row = db.get(BodyLog, (user_id, d))
    values = data.model_dump()
    if all(v in (None, "") for v in values.values()):
        if row:
            db.delete(row)
        return None
    if row is None:
        row = BodyLog(user_id=user_id, date=d)
        db.add(row)
    for k, v in values.items():
        setattr(row, k, v)
    return row


def remove(db: Session, user_id: int, d: date) -> None:
    row = db.get(BodyLog, (user_id, d))
    if row:
        db.delete(row)
