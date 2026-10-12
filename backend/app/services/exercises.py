from __future__ import annotations

import json
import secrets
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models import Exercise, ExerciseKind, RoutineExercise, WorkoutExercise
from app.schemas.exercise import ExerciseCreate, ExerciseOut

LIBRARY_FILE = Path(__file__).resolve().parents[1] / "data" / "exercises.json"


def seed_library(db: Session) -> int:
    """Insert or refresh built-in exercises from app/data/exercises.json. Returns rows touched."""
    items = json.loads(LIBRARY_FILE.read_text())["items"]
    existing = {e.slug: e for e in db.scalars(select(Exercise).where(Exercise.owner_id.is_(None)))}
    touched = 0
    for it in items:
        fields = dict(name=it["name"][:120], kind=ExerciseKind(it["kind"]), equipment=it.get("eq"),
                      category=it.get("cat"), level=it.get("lvl") or None, mechanic=it.get("mech") or None,
                      primary_muscles=it.get("pm", []), secondary_muscles=it.get("sm", []),
                      instructions=it.get("ins", []), images=it.get("img", []), archived=False)
        ex = existing.get(it["id"])
        if ex is None:
            db.add(Exercise(slug=it["id"], owner_id=None, **fields))
            touched += 1
        elif any(getattr(ex, k) != v for k, v in fields.items()):
            for k, v in fields.items():
                setattr(ex, k, v)
            touched += 1
    return touched


def to_out(ex: Exercise) -> ExerciseOut:
    out = ExerciseOut.model_validate(ex)
    out.custom = ex.owner_id is not None
    return out


def list_for_user(db: Session, user_id: int) -> list[ExerciseOut]:
    rows = db.scalars(
        select(Exercise)
        .where(Exercise.archived.is_(False), or_(Exercise.owner_id.is_(None), Exercise.owner_id == user_id))
        .order_by(Exercise.name)
    )
    return [to_out(e) for e in rows]


def visible(db: Session, user_id: int, ids: set[int]) -> dict[int, Exercise]:
    """Fetch exercises by id, ensuring each is a library or the user's own exercise."""
    ids = {i for i in ids if i is not None}
    if not ids:
        return {}
    rows = {e.id: e for e in db.scalars(
        select(Exercise).where(Exercise.id.in_(ids),
                               or_(Exercise.owner_id.is_(None), Exercise.owner_id == user_id)))}
    missing = ids - rows.keys()
    if missing:
        raise HTTPException(400, f"Unknown exercise id(s): {sorted(missing)}")
    return rows


def create_custom(db: Session, user_id: int, data: ExerciseCreate) -> Exercise:
    ex = Exercise(slug=f"u{user_id}-{secrets.token_hex(4)}", owner_id=user_id, name=data.name.strip(),
                  kind=data.kind, equipment=data.equipment, category="custom",
                  primary_muscles=[m.strip().lower() for m in data.primary_muscles if m.strip()],
                  secondary_muscles=[], instructions=[s for s in data.instructions if s.strip()], images=[])
    db.add(ex)
    db.flush()
    return ex


def update_custom(db: Session, user_id: int, ex_id: int, data: ExerciseCreate) -> Exercise:
    ex = db.get(Exercise, ex_id)
    if not ex or ex.owner_id != user_id:
        raise HTTPException(404, "Custom exercise not found.")
    ex.name, ex.kind, ex.equipment = data.name.strip(), data.kind, data.equipment
    ex.primary_muscles = [m.strip().lower() for m in data.primary_muscles if m.strip()]
    ex.instructions = [s for s in data.instructions if s.strip()]
    return ex


def delete_custom(db: Session, user_id: int, ex_id: int) -> str:
    """Delete a custom exercise, or archive it if workouts/routines still reference it."""
    ex = db.get(Exercise, ex_id)
    if not ex or ex.owner_id != user_id:
        raise HTTPException(404, "Custom exercise not found.")
    used = db.scalar(select(WorkoutExercise.id).where(WorkoutExercise.exercise_id == ex_id).limit(1)) or \
        db.scalar(select(RoutineExercise.id).where(RoutineExercise.exercise_id == ex_id).limit(1))
    if used:
        ex.archived = True
        return "archived"
    db.delete(ex)
    return "deleted"
