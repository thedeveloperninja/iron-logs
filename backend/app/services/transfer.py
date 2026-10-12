"""JSON export / import (portable between Iron Log servers)."""
from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import BodyLog, Exercise, Routine, ScheduleDay, User, UserSettings, Workout
from app.schemas.auth import SettingsIO
from app.schemas.body import BodyLogIn, BodyLogOut
from app.schemas.exercise import ExerciseCreate
from app.schemas.routine import RoutineExerciseIn, RoutineIn
from app.schemas.transfer import (
    ExportV1,
    ImportResult,
    XCustomExercise,
    XRoutine,
    XRoutineExercise,
    XWorkout,
    XWorkoutExercise,
)
from app.schemas.workout import SetIO, WorkoutExerciseIn, WorkoutIn
from app.services import body as body_svc
from app.services import exercises as exercise_svc
from app.services import routines as routine_svc
from app.services import workouts as workout_svc
from app.services.common import utcnow


def _key(ex: Exercise | None) -> str | None:
    if ex is None:
        return None
    return f"custom:{ex.name}" if ex.owner_id is not None else f"lib:{ex.slug}"


def export(db: Session, user: User) -> ExportV1:
    customs = db.scalars(select(Exercise).where(Exercise.owner_id == user.id)).all()
    routines = routine_svc.list_routines(db, user.id)
    rkey = {r.id: f"r{r.id}" for r in routines}
    workouts = db.scalars(select(Workout).where(Workout.user_id == user.id).order_by(Workout.date)).unique().all()
    return ExportV1(
        exported_at=utcnow(), username=user.username,
        settings=SettingsIO.model_validate(user.settings) if user.settings else None,
        custom_exercises=[XCustomExercise(name=e.name, kind=e.kind, equipment=e.equipment,
                                          primary_muscles=e.primary_muscles, instructions=e.instructions)
                          for e in customs],
        routines=[XRoutine(key=rkey[r.id], name=r.name, focus=r.focus, color=r.color, exercises=[
            XRoutineExercise(exercise=_key(x.exercise), alt=_key(x.alt_exercise), sets=x.sets, reps=x.reps,
                             rest_seconds=x.rest_seconds) for x in r.exercises]) for r in routines],
        schedule=[rkey.get(rid) if rid else None for rid in routine_svc.get_schedule(db, user.id)],
        workouts=[XWorkout(date=w.date, routine=rkey.get(w.routine_id), name=w.name, color=w.color, notes=w.notes,
                           started_at=w.started_at, finished_at=w.finished_at, exercises=[
                               XWorkoutExercise(exercise=_key(we.exercise), swap=_key(we.swap_exercise),
                                                target_reps=we.target_reps, rest_seconds=we.rest_seconds,
                                                note=we.note, sets=[SetIO.model_validate(s) for s in we.sets])
                               for we in w.exercises]) for w in workouts],
        body_logs=[BodyLogOut.model_validate(b) for b in body_svc.list_logs(db, user.id, None, None)],
    )


def import_(db: Session, user: User, data: ExportV1, mode: str) -> ImportResult:
    skipped: list[str] = []
    if mode == "replace":
        db.execute(delete(Workout).where(Workout.user_id == user.id))
        db.execute(delete(BodyLog).where(BodyLog.user_id == user.id))
        db.execute(delete(ScheduleDay).where(ScheduleDay.user_id == user.id))
        db.execute(delete(Routine).where(Routine.user_id == user.id))
        db.flush()

    # exercise keys -> ids
    lib = {e.slug: e.id for e in db.scalars(select(Exercise).where(Exercise.owner_id.is_(None)))}
    own = {e.name.lower(): e for e in db.scalars(select(Exercise).where(Exercise.owner_id == user.id))}
    for c in data.custom_exercises:
        ex = own.get(c.name.lower())
        if ex is None:
            ex = exercise_svc.create_custom(db, user.id, ExerciseCreate(
                name=c.name, kind=c.kind, equipment=c.equipment, primary_muscles=c.primary_muscles,
                instructions=c.instructions))
            own[c.name.lower()] = ex
        ex.archived = False

    def resolve(key: str | None) -> int | None:
        if not key:
            return None
        if key.startswith("lib:"):
            return lib.get(key[4:])
        if key.startswith("custom:"):
            ex = own.get(key[7:].lower())
            return ex.id if ex else None
        return None

    # settings
    if data.settings is not None:
        s = user.settings or UserSettings(user_id=user.id)
        for k, v in data.settings.model_dump().items():
            setattr(s, k, v)
        user.settings = s

    # routines + schedule
    rmap: dict[str, int] = {}
    for r in data.routines:
        items = []
        for x in r.exercises:
            ex_id = resolve(x.exercise)
            if ex_id is None:
                skipped.append(f"routine '{r.name}': unknown exercise {x.exercise}")
                continue
            items.append(RoutineExerciseIn(exercise_id=ex_id, alt_exercise_id=resolve(x.alt), sets=x.sets,
                                           reps=x.reps, rest_seconds=x.rest_seconds))
        rmap[r.key] = routine_svc.create(db, user.id, RoutineIn(name=r.name, focus=r.focus, color=r.color,
                                                                 exercises=items)).id
    if data.routines:
        routine_svc.set_schedule(db, user.id, [rmap.get(k) if k else None for k in data.schedule])

    # workouts
    for w in data.workouts:
        exs = []
        for x in w.exercises:
            ex_id = resolve(x.exercise)
            if ex_id is None:
                skipped.append(f"workout {w.date}: unknown exercise {x.exercise}")
                continue
            exs.append(WorkoutExerciseIn(exercise_id=ex_id, swap_exercise_id=resolve(x.swap),
                                         target_reps=x.target_reps, rest_seconds=x.rest_seconds, note=x.note,
                                         sets=x.sets))
        workout_svc.upsert(db, user.id, w.date, WorkoutIn(
            routine_id=rmap.get(w.routine) if w.routine else None, name=w.name, color=w.color, notes=w.notes,
            started_at=w.started_at, finished_at=w.finished_at, exercises=exs))

    # body logs
    for b in data.body_logs:
        body_svc.upsert(db, user.id, b.date, BodyLogIn.model_validate(b.model_dump(exclude={"date"})))

    return ImportResult(mode=mode, workouts=len(data.workouts), body_logs=len(data.body_logs),
                        routines=len(data.routines), custom_exercises=len(data.custom_exercises),
                        skipped=skipped[:50])
