"""Iron Log API entry point.

Run locally:  uvicorn app.main:app --reload
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app import __version__
from app.api.router import api_router
from app.core.config import get_settings
from app.db.migrate import run_migrations
from app.db.session import session_factory

log = logging.getLogger("ironlog")

CSP = ("default-src 'self'; img-src 'self' data: blob: https://cdn.jsdelivr.net https://raw.githubusercontent.com; "
       "style-src 'self' 'unsafe-inline'; font-src 'self'; "
       "script-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; "
       "frame-ancestors 'none'; base-uri 'self'; form-action 'self'")


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    if settings.auto_migrate:
        run_migrations()
    if settings.seed_exercises:
        from app.services.exercises import seed_library
        with session_factory()() as db:
            n = seed_library(db)
            db.commit()
            if n:
                log.info("exercise library: %s rows added/updated", n)
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Iron Log API", version=__version__, lifespan=lifespan,
                  docs_url="/api/docs", redoc_url=None, openapi_url="/api/openapi.json")

    app.add_middleware(GZipMiddleware, minimum_size=1024)
    if settings.cors_origins:
        app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=True,
                           allow_methods=["*"], allow_headers=["*"])

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        # CSRF defence: state-changing API calls must carry a custom header. Browsers
        # can't add it to cross-site requests unless CORS allows it.
        if request.url.path.startswith("/api/") and request.method in {"POST", "PUT", "PATCH", "DELETE"} \
                and request.headers.get("x-requested-with") != "IronLog":
            return JSONResponse({"detail": "Missing X-Requested-With: IronLog header."}, status_code=403)
        response = await call_next(request)
        h = response.headers
        h.setdefault("X-Content-Type-Options", "nosniff")
        h.setdefault("Referrer-Policy", "same-origin")
        h.setdefault("X-Frame-Options", "DENY")
        h.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        if not request.url.path.startswith("/api/docs"):
            h.setdefault("Content-Security-Policy", CSP)
        if request.url.path.startswith("/api/"):
            h["Cache-Control"] = "no-store"
        return response

    @app.get("/api/health", tags=["meta"])
    def health():
        return {"ok": True, "version": __version__}

    app.include_router(api_router)
    if settings.exercise_image_dir and settings.exercise_image_dir.is_dir():
        app.mount("/exercise-images", StaticFiles(directory=settings.exercise_image_dir), name="exercise-images")
    _mount_frontend(app, settings.static_dir)
    return app


def _mount_frontend(app: FastAPI, static_dir: Path | None) -> None:
    """Serve the built React app (if configured) with SPA fallback to index.html."""
    if not static_dir or not Path(static_dir).joinpath("index.html").exists():
        return
    root = Path(static_dir).resolve()
    assets = root / "assets"
    if assets.exists():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path.startswith("api/"):
            return JSONResponse({"detail": "Not found."}, status_code=404)
        target = (root / path).resolve()
        if path and target.is_file() and root in target.parents:
            headers = {"Cache-Control": "no-cache"} if target.name in ("sw.js", "index.html", "manifest.webmanifest") \
                else {}
            return FileResponse(target, headers=headers)
        return FileResponse(root / "index.html", headers={"Cache-Control": "no-cache"})


app = create_app()
