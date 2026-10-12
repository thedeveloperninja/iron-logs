from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.exercise import Exercise


class Routine(Base):
    __tablename__ = "routines"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    focus: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    color: Mapped[str] = mapped_column(String(10), nullable=False, default="other")  # push|pull|legs|other
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(),
                                                 onupdate=func.now())

    exercises: Mapped[list[RoutineExercise]] = relationship(
        back_populates="routine", cascade="all, delete-orphan", passive_deletes=True,
        order_by="RoutineExercise.position")


class RoutineExercise(Base):
    __tablename__ = "routine_exercises"
    __table_args__ = (CheckConstraint("sets BETWEEN 1 AND 20", name="sets_range"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    routine_id: Mapped[int] = mapped_column(ForeignKey("routines.id", ondelete="CASCADE"), nullable=False, index=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    exercise_id: Mapped[int] = mapped_column(ForeignKey("exercises.id", ondelete="CASCADE"), nullable=False)
    alt_exercise_id: Mapped[int | None] = mapped_column(ForeignKey("exercises.id", ondelete="SET NULL"))
    sets: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    reps: Mapped[str] = mapped_column(String(16), nullable=False, default="8-12")
    rest_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=90)

    routine: Mapped[Routine] = relationship(back_populates="exercises")
    exercise: Mapped[Exercise] = relationship(foreign_keys=[exercise_id], lazy="joined")
    alt_exercise: Mapped[Exercise | None] = relationship(foreign_keys=[alt_exercise_id], lazy="joined")


class ScheduleDay(Base):
    """Which routine runs on each weekday (0 = Monday ... 6 = Sunday). No row or NULL routine = rest."""
    __tablename__ = "schedule_days"
    __table_args__ = (CheckConstraint("weekday BETWEEN 0 AND 6", name="weekday_range"),)

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    weekday: Mapped[int] = mapped_column(Integer, primary_key=True)
    routine_id: Mapped[int | None] = mapped_column(ForeignKey("routines.id", ondelete="SET NULL"))
