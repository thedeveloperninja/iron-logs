"""Import every model here so Alembic autogenerate and metadata.create_all see them."""
from app.models.body import BodyLog
from app.models.exercise import Exercise, ExerciseKind
from app.models.routine import Routine, RoutineExercise, ScheduleDay
from app.models.user import AppSetting, AuthSession, Invite, User, UserSettings
from app.models.workout import Workout, WorkoutExercise, WorkoutSet

__all__ = [
    "AppSetting", "AuthSession", "BodyLog", "Exercise", "ExerciseKind", "Invite", "Routine", "RoutineExercise",
    "ScheduleDay", "User", "UserSettings", "Workout", "WorkoutExercise", "WorkoutSet",
]
