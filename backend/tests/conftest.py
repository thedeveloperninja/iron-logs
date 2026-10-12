from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

HEADERS = {"X-Requested-With": "IronLog"}

# Run the suite against Postgres with: IRONLOG_TEST_DATABASE_URL=postgresql://... pytest
PG_URL = os.environ.get("IRONLOG_TEST_DATABASE_URL")


def _reset_postgres(url: str) -> None:
    from sqlalchemy import text

    from app.core.config import Settings
    from app.db.session import make_engine
    eng = make_engine(Settings(database_url=url).database_url)
    with eng.begin() as c:
        c.execute(text("DROP SCHEMA public CASCADE"))
        c.execute(text("CREATE SCHEMA public"))
    eng.dispose()


@pytest.fixture()
def app(tmp_path, monkeypatch):
    if PG_URL:
        _reset_postgres(PG_URL)
        monkeypatch.setenv("IRONLOG_DATABASE_URL", PG_URL)
    else:
        monkeypatch.setenv("IRONLOG_DATABASE_URL", f"sqlite:///{tmp_path / 'test.db'}")
    monkeypatch.setenv("IRONLOG_SIGNUP_MODE", "invite")
    from app.core import ratelimit
    from app.core.config import get_settings
    from app.db.session import reset_engine
    get_settings.cache_clear()
    reset_engine()
    ratelimit.reset_all()
    from app.main import create_app
    yield create_app()
    reset_engine()
    get_settings.cache_clear()


@pytest.fixture()
def client(app):
    with TestClient(app, headers=HEADERS) as c:
        yield c


def make_client(app) -> TestClient:
    return TestClient(app, headers=HEADERS)


@pytest.fixture()
def admin(client):
    """First registered user becomes admin; returns a signed-in client."""
    r = client.post("/api/v1/auth/register", json={"username": "admin", "password": "password123"})
    assert r.status_code == 201, r.text
    assert r.json()["isAdmin"] is True
    return client


def invite_user(admin_client, app, username: str) -> TestClient:
    code = admin_client.post("/api/v1/admin/invites", json={"days": 7}).json()["code"]
    c = make_client(app)
    c.__enter__()
    r = c.post("/api/v1/auth/register", json={"username": username, "password": "password123", "invite": code})
    assert r.status_code == 201, r.text
    return c


def lib_id(client: TestClient, slug: str) -> int:
    return next(e["id"] for e in client.get("/api/v1/exercises").json() if e["slug"] == slug)
