from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, Response

from app import __version__
from app.api.deps import DB, SESSION_COOKIE, CurrentUser, session_token
from app.core import ratelimit
from app.core.config import get_settings
from app.models import UserSettings
from app.schemas.auth import ConfigOut, LoginIn, PasswordChangeIn, PasswordConfirmIn, RegisterIn, SettingsIO, UserOut
from app.schemas.common import Ok
from app.services import auth as auth_svc

router = APIRouter(tags=["auth"])


def _set_cookie(response: Response, token: str) -> None:
    s = get_settings()
    response.set_cookie(SESSION_COOKIE, token, max_age=s.session_days * 86400, httponly=True, samesite="lax",
                        secure=s.cookie_secure, path="/")


@router.get("/config", response_model=ConfigOut)
def config(db: DB):
    first = not auth_svc.has_users(db)
    s = get_settings()
    base = "/exercise-images/" if s.exercise_image_dir and s.exercise_image_dir.is_dir() else s.exercise_image_base
    return ConfigOut(version=__version__, signup="open" if first else auth_svc.signup_mode(db), first_user=first,
                     exercise_image_base=base)


@router.post("/auth/register", response_model=UserOut, status_code=201)
def register(body: RegisterIn, request: Request, response: Response, db: DB):
    ip = ratelimit.client_ip(request)
    ratelimit.check(ip)
    try:
        user, token = auth_svc.register(db, body.username, body.password, body.invite,
                                        request.headers.get("user-agent"))
    except Exception:
        ratelimit.fail(ip)
        raise
    _set_cookie(response, token)
    return user


@router.post("/auth/login", response_model=UserOut)
def login(body: LoginIn, request: Request, response: Response, db: DB):
    ip = ratelimit.client_ip(request)
    ratelimit.check(ip)
    user = auth_svc.authenticate(db, body.username, body.password)
    if not user:
        ratelimit.fail(ip)
        raise HTTPException(401, "Wrong username or password.")
    ratelimit.clear(ip)
    _set_cookie(response, auth_svc.create_session(db, user, request.headers.get("user-agent")))
    return user


@router.post("/auth/logout", response_model=Ok)
def logout(request: Request, response: Response, db: DB):
    tok = session_token(request)
    if tok:
        auth_svc.end_session(db, tok)
    response.delete_cookie(SESSION_COOKIE, path="/")
    return Ok()


@router.post("/auth/password", response_model=Ok)
def change_password(body: PasswordChangeIn, request: Request, user: CurrentUser, db: DB):
    auth_svc.change_password(db, user, body.current, body.new, session_token(request))
    return Ok()


@router.post("/auth/delete-account", response_model=Ok)
def delete_account(body: PasswordConfirmIn, response: Response, user: CurrentUser, db: DB):
    auth_svc.delete_account(db, user, body.password)
    response.delete_cookie(SESSION_COOKIE, path="/")
    return Ok()


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser):
    return user


@router.get("/me/settings", response_model=SettingsIO)
def get_my_settings(user: CurrentUser):
    return user.settings or SettingsIO()


@router.put("/me/settings", response_model=SettingsIO)
def put_my_settings(body: SettingsIO, user: CurrentUser, db: DB):
    if user.settings is None:
        user.settings = UserSettings(user_id=user.id)
    for k, v in body.model_dump().items():
        setattr(user.settings, k, v)
    db.flush()
    return user.settings
