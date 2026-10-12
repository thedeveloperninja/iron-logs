from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models import Exercise, Routine, RoutineExercise, ScheduleDay
from app.schemas.routine import RoutineIn, TemplateOut
from app.services import exercises as exercise_svc
from app.services.templates import TEMPLATES


def list_routines(db: Session, user_id: int) -> list[Routine]:
    return list(db.scalars(select(Routine).where(Routine.user_id == user_id)
                           .order_by(Routine.position, Routine.id)).unique())


def get_owned(db: Session, user_id: int, routine_id: int) -> Routine:
    r = db.get(Routine, routine_id)
    if not r or r.user_id != user_id:
        raise HTTPException(404, "Routine not found.")
    return r


def _apply(db: Session, user_id: int, routine: Routine, data: RoutineIn) -> None:
    exercise_svc.visible(db, user_id, {e.exercise_id for e in data.exercises} |
                         {e.alt_exercise_id for e in data.exercises if e.alt_exercise_id})
    routine.name, routine.focus, routine.color = data.name.strip(), data.focus.strip(), data.color
    routine.exercises.clear()
    db.flush()
    for i, e in enumerate(data.exercises):
        routine.exercises.append(RoutineExercise(position=i, exercise_id=e.exercise_id,
                                                 alt_exercise_id=e.alt_exercise_id, sets=e.sets,
                                                 reps=e.reps.strip() or "8-12", rest_seconds=e.rest_seconds))


def create(db: Session, user_id: int, data: RoutineIn) -> Routine:
    pos = db.scalar(select(func.coalesce(func.max(Routine.position), -1)).where(Routine.user_id == user_id)) + 1
    r = Routine(user_id=user_id, name=data.name, position=pos)
    db.add(r)
    _apply(db, user_id, r, data)
    db.flush()
    db.refresh(r)
    return r


def update(db: Session, user_id: int, routine_id: int, data: RoutineIn) -> Routine:
    r = get_owned(db, user_id, routine_id)
    _apply(db, user_id, r, data)
    db.flush()
    db.refresh(r)
    return r


def remove(db: Session, user_id: int, routine_id: int) -> None:
    db.delete(get_owned(db, user_id, routine_id))


def reorder(db: Session, user_id: int, ids: list[int]) -> None:
    owned = {r.id: r for r in list_routines(db, user_id)}
    if set(ids) != set(owned):
        raise HTTPException(400, "Reorder must list every routine exactly once.")
    for i, rid in enumerate(ids):
        owned[rid].position = i


# ---------------------------------------------------------------- schedule
def get_schedule(db: Session, user_id: int) -> list[int | None]:
    days: list[int | None] = [None] * 7
    for row in db.scalars(select(ScheduleDay).where(ScheduleDay.user_id == user_id)):
        days[row.weekday] = row.routine_id
    return days


def set_schedule(db: Session, user_id: int, days: list[int | None]) -> list[int | None]:
    wanted = {d for d in days if d is not None}
    if wanted:
        owned = set(db.scalars(select(Routine.id).where(Routine.user_id == user_id, Routine.id.in_(wanted))))
        if wanted - owned:
            raise HTTPException(400, "Schedule refers to a routine you don't have.")
    db.execute(delete(ScheduleDay).where(ScheduleDay.user_id == user_id))
    for wd, rid in enumerate(days):
        if rid is not None:
            db.add(ScheduleDay(user_id=user_id, weekday=wd, routine_id=rid))
    return days


# ---------------------------------------------------------------- templates
def list_templates() -> list[TemplateOut]:
    return [TemplateOut(key=k, name=t["name"], description=t["description"],
                        days_per_week=sum(1 for d in t["schedule"] if d)) for k, t in TEMPLATES.items()]


def apply_template(db: Session, user_id: int, key: str, replace: bool) -> list[Routine]:
    tpl = TEMPLATES.get(key)
    if not tpl:
        raise HTTPException(404, "Unknown template.")
    slugs = {s for _, _, _, exs in tpl["routines"].values() for m, a, *_ in exs for s in (m, a) if s}
    by_slug = {e.slug: e.id for e in db.scalars(select(Exercise).where(Exercise.slug.in_(slugs),
                                                                      Exercise.owner_id.is_(None)))}
    missing = slugs - by_slug.keys()
    if missing:
        raise HTTPException(500, f"Exercise library is missing: {sorted(missing)}")
    if replace:
        db.execute(delete(ScheduleDay).where(ScheduleDay.user_id == user_id))
        for r in list_routines(db, user_id):
            db.delete(r)
        db.flush()
    created: dict[str, Routine] = {}
    for rkey, (name, focus, color, exs) in tpl["routines"].items():
        data = RoutineIn(name=name, focus=focus, color=color, exercises=[
            {"exercise_id": by_slug[m], "alt_exercise_id": by_slug.get(a) if a else None, "sets": s, "reps": reps,
             "rest_seconds": rest} for m, a, s, reps, rest in exs])
        created[rkey] = create(db, user_id, data)
    set_schedule(db, user_id, [created[k].id if k else None for k in tpl["schedule"]])
    return list(created.values())
