from __future__ import annotations

from datetime import date

from fastapi import APIRouter, HTTPException, Query, Response

from app.api.deps import DB, CurrentUser
from app.schemas.workout import ExerciseContext, WorkoutIn, WorkoutOut, WorkoutSummary
from app.services import workouts as workout_svc

router = APIRouter(prefix="/workouts", tags=["workouts"])


@router.get("", response_model=list[WorkoutSummary])
def list_workouts(user: CurrentUser, db: DB, start: date | None = Query(default=None, alias="from"),
                  end: date | None = Query(default=None, alias="to")):
    return workout_svc.summaries(db, user.id, start, end)


@router.get("/context", response_model=list[ExerciseContext])
def workout_context(user: CurrentUser, db: DB, before: date, ids: str = Query(max_length=2000)):
    """Previous sets and best e1RM for the given exercise ids (comma-separated), before a date."""
    try:
        id_set = {int(x) for x in ids.split(",") if x.strip()}
    except ValueError:
        raise HTTPException(400, "ids must be comma-separated integers.") from None
    if len(id_set) > 60:
        raise HTTPException(400, "Too many ids.")
    return workout_svc.context(db, user.id, id_set, before)


@router.get("/{day}", response_model=WorkoutOut)
def get_workout(day: date, user: CurrentUser, db: DB):
    return workout_svc.get(db, user.id, day)


@router.put("/{day}", response_model=WorkoutOut)
def put_workout(day: date, body: WorkoutIn, user: CurrentUser, db: DB):
    return workout_svc.upsert(db, user.id, day, body)


@router.delete("/{day}", status_code=204)
def delete_workout(day: date, user: CurrentUser, db: DB):
    workout_svc.remove(db, user.id, day)
    return Response(status_code=204)
