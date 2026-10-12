from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Query, Response

from app.api.deps import DB, CurrentUser
from app.schemas.body import BodyLogIn, BodyLogOut
from app.services import body as body_svc

router = APIRouter(prefix="/body", tags=["body"])


@router.get("", response_model=list[BodyLogOut])
def list_body(user: CurrentUser, db: DB, start: date | None = Query(default=None, alias="from"),
              end: date | None = Query(default=None, alias="to")):
    return body_svc.list_logs(db, user.id, start, end)


@router.put("/{day}", response_model=BodyLogOut | None)
def put_body(day: date, body: BodyLogIn, user: CurrentUser, db: DB):
    return body_svc.upsert(db, user.id, day, body)


@router.delete("/{day}", status_code=204)
def delete_body(day: date, user: CurrentUser, db: DB):
    body_svc.remove(db, user.id, day)
    return Response(status_code=204)
