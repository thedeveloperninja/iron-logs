"""Run Alembic migrations programmatically (used on startup and by `python -m app.db.migrate`)."""
from __future__ import annotations

from pathlib import Path

from alembic.config import Config

from alembic import command
from app.core.config import get_settings

BACKEND_DIR = Path(__file__).resolve().parents[2]


def alembic_config() -> Config:
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    cfg.set_main_option("sqlalchemy.url", get_settings().database_url.replace("%", "%%"))
    return cfg


def run_migrations() -> None:
    command.upgrade(alembic_config(), "head")


if __name__ == "__main__":
    run_migrations()
    print("Database is up to date.")
