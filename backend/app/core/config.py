"""Application settings, read from environment variables (prefix IRONLOG_) or a .env file."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="IRONLOG_", env_file=".env", extra="ignore")

    # Database. SQLite by default; any SQLAlchemy URL works (e.g. postgresql+psycopg://user:pw@host/db).
    database_url: str = f"sqlite:///{BACKEND_DIR / 'data' / 'ironlog.db'}"
    auto_migrate: bool = True          # run Alembic migrations on startup
    seed_exercises: bool = True        # load/refresh the built-in exercise library on startup

    # Accounts
    signup_mode: Literal["open", "invite", "closed"] = "invite"  # default until an admin changes it in the app
    session_days: int = 90
    cookie_secure: bool = False        # set true when served over HTTPS
    trust_proxy: bool = False          # trust X-Forwarded-For (only behind your own reverse proxy)

    # Frontend
    static_dir: Path | None = None     # built frontend (dist). Served at / when set and present.
    cors_origins: list[str] = []       # only needed if the frontend is hosted on another origin
    exercise_image_base: str = "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/"
    exercise_image_dir: Path | None = None  # self-hosted images (scripts/fetch_exercise_images.py); overrides the base

    log_level: str = "info"

    @field_validator("database_url")
    @classmethod
    def _normalize_db_url(cls, v: str) -> str:
        """Accept Postgres URIs exactly as Supabase/Neon show them (postgres:// or postgresql://)."""
        v = v.strip()
        for prefix in ("postgres://", "postgresql://"):
            if v.startswith(prefix):
                return "postgresql+psycopg://" + v[len(prefix):]
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()
