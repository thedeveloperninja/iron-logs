from __future__ import annotations

from fastapi import APIRouter, Query, Response

from app.api.deps import DB, CurrentUser
from app.schemas.common import Ok
from app.schemas.routine import ReorderIn, RoutineIn, RoutineOut, ScheduleIO, TemplateOut
from app.services import routines as routine_svc

router = APIRouter(tags=["routines"])


@router.get("/routines", response_model=list[RoutineOut])
def list_routines(user: CurrentUser, db: DB):
    return routine_svc.list_routines(db, user.id)


@router.post("/routines", response_model=RoutineOut, status_code=201)
def create_routine(body: RoutineIn, user: CurrentUser, db: DB):
    return routine_svc.create(db, user.id, body)


@router.put("/routines/{routine_id}", response_model=RoutineOut)
def update_routine(routine_id: int, body: RoutineIn, user: CurrentUser, db: DB):
    return routine_svc.update(db, user.id, routine_id, body)


@router.delete("/routines/{routine_id}", status_code=204)
def delete_routine(routine_id: int, user: CurrentUser, db: DB):
    routine_svc.remove(db, user.id, routine_id)
    return Response(status_code=204)


@router.post("/routines/reorder", response_model=Ok)
def reorder_routines(body: ReorderIn, user: CurrentUser, db: DB):
    routine_svc.reorder(db, user.id, body.ids)
    return Ok()


@router.get("/schedule", response_model=ScheduleIO)
def get_schedule(user: CurrentUser, db: DB):
    return ScheduleIO(days=routine_svc.get_schedule(db, user.id))


@router.put("/schedule", response_model=ScheduleIO)
def put_schedule(body: ScheduleIO, user: CurrentUser, db: DB):
    return ScheduleIO(days=routine_svc.set_schedule(db, user.id, body.days))


@router.get("/templates", response_model=list[TemplateOut])
def list_templates(_: CurrentUser):
    return routine_svc.list_templates()


@router.post("/templates/{key}/apply", response_model=list[RoutineOut])
def apply_template(key: str, user: CurrentUser, db: DB, replace: bool = Query(default=False)):
    return routine_svc.apply_template(db, user.id, key, replace)
