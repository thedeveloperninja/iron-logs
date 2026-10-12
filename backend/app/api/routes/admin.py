from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import DB, AdminUser
from app.schemas.admin import AdminFlagIn, AdminOverview, InviteIn, InviteOut, SignupModeIn, TempPasswordOut
from app.schemas.common import Ok
from app.services import admin as admin_svc
from app.services import auth as auth_svc

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("", response_model=AdminOverview)
def overview(_: AdminUser, db: DB):
    return admin_svc.overview(db)


@router.put("/signup", response_model=Ok)
def set_signup(body: SignupModeIn, _: AdminUser, db: DB):
    auth_svc.set_signup_mode(db, body.mode)
    return Ok()


@router.post("/invites", response_model=InviteOut, status_code=201)
def create_invite(body: InviteIn, admin: AdminUser, db: DB):
    inv = admin_svc.create_invite(db, admin, body.days, body.note)
    return InviteOut(code=inv.code, note=inv.note, created_at=inv.created_at, expires_at=inv.expires_at)


@router.delete("/invites/{code}", response_model=Ok)
def revoke_invite(code: str, _: AdminUser, db: DB):
    admin_svc.revoke_invite(db, code)
    return Ok()


@router.post("/users/{uid}/reset-password", response_model=TempPasswordOut)
def reset_password(uid: int, _: AdminUser, db: DB):
    return TempPasswordOut(temp_password=admin_svc.reset_password(db, uid))


@router.put("/users/{uid}/admin", response_model=Ok)
def set_admin(uid: int, body: AdminFlagIn, admin: AdminUser, db: DB):
    admin_svc.set_admin(db, admin, uid, body.is_admin)
    return Ok()


@router.delete("/users/{uid}", response_model=Ok)
def delete_user(uid: int, admin: AdminUser, db: DB):
    admin_svc.delete_user(db, admin, uid)
    return Ok()
