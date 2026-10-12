from __future__ import annotations

from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import security
from app.core.config import get_settings
from app.models import AppSetting, AuthSession, Invite, User, UserSettings
from app.services.common import as_utc, utcnow

SIGNUP_KEY = "signup_mode"


# ---------------------------------------------------------------- server settings
def has_users(db: Session) -> bool:
    return db.scalar(select(User.id).limit(1)) is not None


def signup_mode(db: Session) -> str:
    row = db.get(AppSetting, SIGNUP_KEY)
    return row.value if row and row.value in ("open", "invite", "closed") else get_settings().signup_mode


def set_signup_mode(db: Session, mode: str) -> None:
    row = db.get(AppSetting, SIGNUP_KEY)
    if row:
        row.value = mode
    else:
        db.add(AppSetting(key=SIGNUP_KEY, value=mode))


# ---------------------------------------------------------------- sessions
def create_session(db: Session, user: User, user_agent: str | None) -> str:
    token = security.new_token()
    now = utcnow()
    db.add(AuthSession(token_hash=security.hash_token(token), user_id=user.id, created_at=now,
                       expires_at=now + timedelta(days=get_settings().session_days),
                       user_agent=(user_agent or "")[:255] or None))
    db.execute(delete(AuthSession).where(AuthSession.expires_at < now))
    user.last_seen_at = now
    return token


def user_from_token(db: Session, token: str) -> User | None:
    sess = db.scalar(select(AuthSession).where(AuthSession.token_hash == security.hash_token(token)))
    if not sess:
        return None
    now = utcnow()
    if as_utc(sess.expires_at) < now:
        db.delete(sess)
        return None
    user = sess.user
    last = as_utc(user.last_seen_at)
    if last is None or (now - last).total_seconds() > 300:
        user.last_seen_at = now
    return user


def end_session(db: Session, token: str) -> None:
    db.execute(delete(AuthSession).where(AuthSession.token_hash == security.hash_token(token)))


# ---------------------------------------------------------------- accounts
def register(db: Session, username: str, password: str, invite_code: str | None,
             user_agent: str | None) -> tuple[User, str]:
    first = not has_users(db)
    mode = "open" if first else signup_mode(db)
    invite: Invite | None = None
    if mode == "closed":
        raise HTTPException(403, "Sign-ups are closed on this server. Ask the admin for an account.")
    if mode == "invite":
        code = (invite_code or "").strip().upper()
        invite = db.get(Invite, code) if code else None
        if not invite or invite.used_by is not None or as_utc(invite.expires_at) < utcnow():
            raise HTTPException(403, "That invite code is invalid, already used or expired.")
    if db.scalar(select(User.id).where(User.username_lower == username.lower())):
        raise HTTPException(409, "That username is taken.")
    user = User(username=username, username_lower=username.lower(),
                password_hash=security.hash_password(password), is_admin=first, created_at=utcnow())
    user.settings = UserSettings()
    db.add(user)
    try:
        db.flush()
    except IntegrityError:
        raise HTTPException(409, "That username is taken.") from None
    if invite:
        invite.used_by, invite.used_at = user.id, utcnow()
    return user, create_session(db, user, user_agent)


def authenticate(db: Session, username: str, password: str) -> User | None:
    user = db.scalar(select(User).where(User.username_lower == username.lower()))
    ok = security.verify_password(password, user.password_hash if user else security.DUMMY_HASH)
    return user if user and ok else None


def change_password(db: Session, user: User, current: str, new: str, keep_token: str | None) -> None:
    if not security.verify_password(current, user.password_hash):
        raise HTTPException(400, "Current password is wrong.")
    user.password_hash = security.hash_password(new)
    q = delete(AuthSession).where(AuthSession.user_id == user.id)
    if keep_token:
        q = q.where(AuthSession.token_hash != security.hash_token(keep_token))
    db.execute(q)


def delete_account(db: Session, user: User, password: str) -> None:
    if not security.verify_password(password, user.password_hash):
        raise HTTPException(400, "Password is wrong.")
    if user.is_admin:
        admins = db.scalar(select(func.count()).select_from(User).where(User.is_admin.is_(True)))
        others = db.scalar(select(func.count()).select_from(User).where(User.id != user.id))
        if admins == 1 and others:
            raise HTTPException(400, "You're the only admin. Make someone else admin first.")
    db.delete(user)
