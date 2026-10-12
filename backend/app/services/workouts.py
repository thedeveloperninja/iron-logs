from __future__ import annotations

from collections import defaultdict
from datetime import date

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import Exercise, ExerciseKind, Routine, Workout, WorkoutExercise, WorkoutSet
from app.schemas.workout import ExerciseContext, HistoryPoint, PreviousSets, SetIO, WorkoutIn, WorkoutSummary
from app.services import exercises as exercise_svc
from app.services.common import e1rm


def _load(db: Session, user_id: int, d: date) -> Workout | None:
    return db.scalar(select(Workout).where(Workout.user_id == user_id, Workout.date == d)
                     .options(selectinload(Workout.exercises).selectinload(WorkoutExercise.sets)))


def get(db: Session, user_id: int, d: date) -> Workout:
    w = _load(db, user_id, d)
    if not w:
        raise HTTPException(404, "No workout on this date.")
    return w


def upsert(db: Session, user_id: int, d: date, data: WorkoutIn) -> Workout:
    """Create or fully replace the workout for a date (exercises and sets included)."""
    exercise_svc.visible(db, user_id, {e.exercise_id for e in data.exercises} |
                         {e.swap_exercise_id for e in data.exercises if e.swap_exercise_id})
    if data.routine_id is not None:
        r = db.get(Routine, data.routine_id)
        if not r or r.user_id != user_id:
            data.routine_id = None
    w = _load(db, user_id, d)
    if w is None:
        w = Workout(user_id=user_id, date=d, name=data.name)
        db.add(w)
    w.routine_id, w.name, w.color, w.notes = data.routine_id, data.name.strip(), data.color, data.notes
    w.started_at, w.finished_at = data.started_at, data.finished_at
    w.exercises.clear()
    db.flush()
    for i, e in enumerate(data.exercises):
        we = WorkoutExercise(position=i, exercise_id=e.exercise_id, swap_exercise_id=e.swap_exercise_id,
                             target_reps=e.target_reps, rest_seconds=e.rest_seconds, note=e.note or None)
        we.sets = [WorkoutSet(position=j, weight_kg=s.weight_kg, reps=s.reps, rir=s.rir, done=s.done)
                   for j, s in enumerate(e.sets)]
        w.exercises.append(we)
    db.flush()
    db.refresh(w)
    return w


def remove(db: Session, user_id: int, d: date) -> None:
    w = _load(db, user_id, d)
    if w:
        db.delete(w)


# ---------------------------------------------------------------- stats helpers
def _done_sets(db: Session, user_id: int, before: date | None = None, exercise_ids: set[int] | None = None):
    """Yield (date, exercise_id, kind, weight, reps) for completed sets, oldest first."""
    q = (select(Workout.date, WorkoutExercise.exercise_id, Exercise.kind, WorkoutSet.weight_kg, WorkoutSet.reps,
                WorkoutSet.position)
         .join(WorkoutExercise, WorkoutExercise.workout_id == Workout.id)
         .join(WorkoutSet, WorkoutSet.workout_exercise_id == WorkoutExercise.id)
         .join(Exercise, Exercise.id == WorkoutExercise.exercise_id)
         .where(Workout.user_id == user_id, WorkoutSet.done.is_(True))
         .order_by(Workout.date, WorkoutExercise.position, WorkoutSet.position))
    if before is not None:
        q = q.where(Workout.date < before)
    if exercise_ids:
        q = q.where(WorkoutExercise.exercise_id.in_(exercise_ids))
    return db.execute(q).all()


def summaries(db: Session, user_id: int, start: date | None, end: date | None) -> list[WorkoutSummary]:
    q = (select(Workout).where(Workout.user_id == user_id)
         .options(selectinload(Workout.exercises).selectinload(WorkoutExercise.sets))
         .order_by(Workout.date.desc()))
    if start:
        q = q.where(Workout.date >= start)
    if end:
        q = q.where(Workout.date <= end)
    workouts = list(db.scalars(q).unique())
    # best e1RM per exercise per date, to count PRs
    per_day: dict[date, dict[int, float]] = defaultdict(dict)
    for d, ex_id, kind, kg, reps, _ in _done_sets(db, user_id):
        if kind == ExerciseKind.weight and kg and reps:
            v = e1rm(kg, reps)
            if v > per_day[d].get(ex_id, 0):
                per_day[d][ex_id] = v
    prs_by_day: dict[date, int] = {}
    best: dict[int, float] = {}
    for d in sorted(per_day):
        n = 0
        for ex_id, v in per_day[d].items():
            if ex_id in best and v > best[ex_id] + 1e-6:
                n += 1
            best[ex_id] = max(best.get(ex_id, 0), v)
        prs_by_day[d] = n
    out = []
    for w in workouts:
        done = total = 0
        vol = 0.0
        for we in w.exercises:
            for s in we.sets:
                total += 1
                if s.done:
                    done += 1
                    if we.exercise.kind == ExerciseKind.weight and s.weight_kg and s.reps:
                        vol += s.weight_kg * s.reps
        out.append(WorkoutSummary(date=w.date, name=w.name, color=w.color, sets_done=done, sets_total=total,
                                  volume_kg=round(vol, 1), pr_count=prs_by_day.get(w.date, 0),
                                  finished=w.finished_at is not None))
    return out


def context(db: Session, user_id: int, exercise_ids: set[int], before: date) -> list[ExerciseContext]:
    """For each exercise: sets from the most recent earlier session + best e1RM before `before`."""
    rows = _done_sets(db, user_id, before=before, exercise_ids=exercise_ids)
    last_date: dict[int, date] = {}
    sets: dict[int, list[SetIO]] = defaultdict(list)
    best: dict[int, float] = {}
    for d, ex_id, kind, kg, reps, _ in rows:
        if last_date.get(ex_id) != d:
            last_date[ex_id] = d
            sets[ex_id] = []
        sets[ex_id].append(SetIO(weight_kg=kg, reps=reps, done=True))
        if kind == ExerciseKind.weight and kg and reps:
            best[ex_id] = max(best.get(ex_id, 0), e1rm(kg, reps))
    return [ExerciseContext(exercise_id=i,
                            previous=PreviousSets(date=last_date[i], sets=sets[i]) if i in last_date else None,
                            best_e1rm=round(best[i], 1) if i in best else None) for i in sorted(exercise_ids)]


def history(db: Session, user_id: int, exercise_id: int, limit: int = 200) -> list[HistoryPoint]:
    exercise_svc.visible(db, user_id, {exercise_id})
    by_day: dict[date, list[tuple]] = defaultdict(list)
    for d, _, kind, kg, reps, _ in _done_sets(db, user_id, exercise_ids={exercise_id}):
        by_day[d].append((kind, kg, reps))
    out = []
    for d in sorted(by_day)[-limit:]:
        rows = by_day[d]
        kind = rows[0][0]
        kgs = [kg for _, kg, _ in rows if kg is not None]
        top = (min(kgs) if kind == ExerciseKind.assist else max(kgs)) if kgs else None
        vol = sum(kg * reps for _, kg, reps in rows if kg and reps) if kind == ExerciseKind.weight else 0.0
        best = max((e1rm(kg, reps) for _, kg, reps in rows if kg and reps), default=None) \
            if kind == ExerciseKind.weight else None
        out.append(HistoryPoint(date=d, sets=[SetIO(weight_kg=kg, reps=reps, done=True) for _, kg, reps in rows],
                                top_kg=top, volume_kg=round(vol, 1), e1rm=round(best, 1) if best else None))
    return out
