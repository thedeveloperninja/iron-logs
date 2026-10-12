from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import DB, CurrentUser
from app.schemas.exercise import ExerciseCreate, ExerciseOut
from app.schemas.workout import HistoryPoint
from app.services import exercises as exercise_svc
from app.services import workouts as workout_svc

router = APIRouter(prefix="/exercises", tags=["exercises"])


@router.get("", response_model=list[ExerciseOut])
def list_exercises(user: CurrentUser, db: DB):
    """Built-in library plus the user's own custom exercises."""
    return exercise_svc.list_for_user(db, user.id)


@router.post("", response_model=ExerciseOut, status_code=201)
def create_exercise(body: ExerciseCreate, user: CurrentUser, db: DB):
    return exercise_svc.to_out(exercise_svc.create_custom(db, user.id, body))


@router.put("/{exercise_id}", response_model=ExerciseOut)
def update_exercise(exercise_id: int, body: ExerciseCreate, user: CurrentUser, db: DB):
    return exercise_svc.to_out(exercise_svc.update_custom(db, user.id, exercise_id, body))


@router.delete("/{exercise_id}")
def delete_exercise(exercise_id: int, user: CurrentUser, db: DB):
    return {"result": exercise_svc.delete_custom(db, user.id, exercise_id)}


@router.get("/{exercise_id}/history", response_model=list[HistoryPoint])
def exercise_history(exercise_id: int, user: CurrentUser, db: DB):
    return workout_svc.history(db, user.id, exercise_id)
