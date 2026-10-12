from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.exercise import Exercise


class Workout(Base):
    """One training session. A user has at most one workout per calendar date."""
    __tablename__ = "workouts"
    __table_args__ = (UniqueConstraint("user_id", "date", name="uq_workouts_user_date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    routine_id: Mapped[int | None] = mapped_column(ForeignKey("routines.id", ondelete="SET NULL"))
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    color: Mapped[str] = mapped_column(String(10), nullable=False, default="other")
    notes: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(),
                                                 onupdate=func.now())

    exercises: Mapped[list[WorkoutExercise]] = relationship(
        back_populates="workout", cascade="all, delete-orphan", passive_deletes=True,
        order_by="WorkoutExercise.position")


class WorkoutExercise(Base):
    __tablename__ = "workout_exercises"

    id: Mapped[int] = mapped_column(primary_key=True)
    workout_id: Mapped[int] = mapped_column(ForeignKey("workouts.id", ondelete="CASCADE"), nullable=False, index=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    exercise_id: Mapped[int] = mapped_column(ForeignKey("exercises.id", ondelete="CASCADE"), nullable=False,
                                             index=True)
    # The other option the user can swap to (from the routine's main/alternative pair)
    swap_exercise_id: Mapped[int | None] = mapped_column(ForeignKey("exercises.id", ondelete="SET NULL"))
    target_reps: Mapped[str] = mapped_column(String(16), nullable=False, default="")
    rest_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=90)
    note: Mapped[str | None] = mapped_column(String(500))

    workout: Mapped[Workout] = relationship(back_populates="exercises")
    exercise: Mapped[Exercise] = relationship(foreign_keys=[exercise_id], lazy="joined")
    swap_exercise: Mapped[Exercise | None] = relationship(foreign_keys=[swap_exercise_id], lazy="joined")
    sets: Mapped[list[WorkoutSet]] = relationship(
        back_populates="workout_exercise", cascade="all, delete-orphan", passive_deletes=True,
        order_by="WorkoutSet.position", lazy="selectin")


class WorkoutSet(Base):
    __tablename__ = "workout_sets"

    id: Mapped[int] = mapped_column(primary_key=True)
    workout_exercise_id: Mapped[int] = mapped_column(ForeignKey("workout_exercises.id", ondelete="CASCADE"),
                                                     nullable=False, index=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    weight_kg: Mapped[float | None] = mapped_column(Float)
    reps: Mapped[int | None] = mapped_column(Integer)   # seconds for timed exercises
    rir: Mapped[int | None] = mapped_column(Integer)
    done: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    workout_exercise: Mapped[WorkoutExercise] = relationship(back_populates="sets")
