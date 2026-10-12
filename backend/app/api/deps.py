from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import User
from app.services import auth as auth_svc

SESSION_COOKIE = "ironlog_session"

DB = Annotated[Session, Depends(get_db)]


def session_token(request: Request) -> str | None:
    tok = request.cookies.get(SESSION_COOKIE)
    if tok:
        return tok
    auth = request.headers.get("authorization", "")
    return auth[7:].strip() if auth.lower().startswith("bearer ") else None


def current_user(request: Request, db: DB) -> User:
    tok = session_token(request)
    user = auth_svc.user_from_token(db, tok) if tok else None
    if user is None:
        raise HTTPException(401, "Not signed in.")
    return user


def admin_user(user: Annotated[User, Depends(current_user)]) -> User:
    if not user.is_admin:
        raise HTTPException(403, "Admins only.")
    return user


CurrentUser = Annotated[User, Depends(current_user)]
AdminUser = Annotated[User, Depends(admin_user)]
