"""Engine and session management.

One engine per process. Each request gets its own Session through the
`get_db` dependency: it commits when the request handler returns normally
and rolls back on any exception, so handlers never call commit themselves.
"""
from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

_engine: Engine | None = None
_SessionLocal: sessionmaker[Session] | None = None


def _sqlite_pragmas(dbapi_conn, _record) -> None:
    cur = dbapi_conn.cursor()
    cur.execute("PRAGMA foreign_keys=ON")
    cur.execute("PRAGMA journal_mode=WAL")
    cur.execute("PRAGMA synchronous=NORMAL")
    cur.execute("PRAGMA busy_timeout=5000")
    cur.close()


def make_engine(url: str) -> Engine:
    kwargs: dict = {"pool_pre_ping": True}
    if url.startswith("sqlite"):
        path = url.split("///", 1)[-1]
        if path and path != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        kwargs["connect_args"] = {"check_same_thread": False, "timeout": 10}
    elif url.startswith("postgresql"):
        connect_args: dict = {}
        local = ("@localhost", "@127.0.0.1", "@db:", "@postgres:", "host=/")
        if "sslmode=" not in url and not any(h in url for h in local):
            connect_args["sslmode"] = "require"   # hosted Postgres (Supabase, Neon, RDS) needs TLS
        if ":6543" in url:
            connect_args["prepare_threshold"] = None  # Supabase transaction pooler can't use prepared statements
        kwargs.update(connect_args=connect_args, pool_size=5, max_overflow=5, pool_recycle=1800)
    engine = create_engine(url, **kwargs)
    if url.startswith("sqlite"):
        event.listen(engine, "connect", _sqlite_pragmas)
    return engine


def get_engine() -> Engine:
    global _engine, _SessionLocal
    if _engine is None:
        _engine = make_engine(get_settings().database_url)
        _SessionLocal = sessionmaker(bind=_engine, autoflush=False, expire_on_commit=False)
    return _engine


def session_factory() -> sessionmaker[Session]:
    get_engine()
    assert _SessionLocal is not None
    return _SessionLocal


def reset_engine() -> None:
    """Drop the cached engine (used by tests after changing settings)."""
    global _engine, _SessionLocal
    if _engine is not None:
        _engine.dispose()
    _engine, _SessionLocal = None, None


def get_db() -> Iterator[Session]:
    db = session_factory()()
    try:
        yield db
        db.commit()
    except BaseException:
        db.rollback()
        raise
    finally:
        db.close()
