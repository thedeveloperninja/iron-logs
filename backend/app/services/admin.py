from __future__ import annotations

from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from app.core import security
from app.models import AuthSession, Invite, User, Workout
from app.schemas.admin import AdminOverview, AdminUser, InviteOut
from app.services import auth as auth_svc
from app.services.common import utcnow


def overview(db: Session) -> AdminOverview:
    counts = dict(db.execute(select(Workout.user_id, func.count()).group_by(Workout.user_id)).all())
    users = [AdminUser(id=u.id, username=u.username, is_admin=u.is_admin, created_at=u.created_at,
                       last_seen_at=u.last_seen_at, workouts=counts.get(u.id, 0))
             for u in db.scalars(select(User).order_by(User.created_at))]
    invites = [InviteOut(code=i.code, note=i.note, created_at=i.created_at, expires_at=i.expires_at,
                         used_by=i.used_by_user.username if i.used_by_user else None)
               for i in db.scalars(select(Invite).where(or_(Invite.used_by.is_not(None), Invite.expires_at > utcnow()))
                                   .order_by(Invite.created_at.desc()).limit(50))]
    return AdminOverview(signup=auth_svc.signup_mode(db), users=users, invites=invites)


def create_invite(db: Session, admin: User, days: int, note: str | None) -> Invite:
    now = utcnow()
    inv = Invite(code=security.new_invite_code(), note=note, created_by=admin.id, created_at=now,
                 expires_at=now + timedelta(days=days))
    db.add(inv)
    db.flush()
    return inv


def revoke_invite(db: Session, code: str) -> None:
    db.execute(delete(Invite).where(Invite.code == code, Invite.used_by.is_(None)))


def _user(db: Session, uid: int) -> User:
    u = db.get(User, uid)
    if not u:
        raise HTTPException(404, "User not found.")
    return u


def reset_password(db: Session, uid: int) -> str:
    u = _user(db, uid)
    temp = security.new_temp_password()
    u.password_hash = security.hash_password(temp)
    db.execute(delete(AuthSession).where(AuthSession.user_id == uid))
    return temp


def set_admin(db: Session, admin: User, uid: int, is_admin: bool) -> None:
    if uid == admin.id and not is_admin:
        raise HTTPException(400, "You can't remove your own admin role.")
    _user(db, uid).is_admin = is_admin


def delete_user(db: Session, admin: User, uid: int) -> None:
    if uid == admin.id:
        raise HTTPException(400, "Delete your own account from Account settings.")
    db.delete(_user(db, uid))
