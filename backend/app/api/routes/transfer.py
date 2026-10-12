from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from app.api.deps import DB, CurrentUser
from app.schemas.transfer import ExportV1, ImportResult
from app.services import transfer as transfer_svc

router = APIRouter(tags=["data"])


@router.get("/export", response_model=ExportV1)
def export_data(user: CurrentUser, db: DB):
    data = transfer_svc.export(db, user)
    fname = f"iron-log-{user.username}-{data.exported_at:%Y-%m-%d}.json"
    return JSONResponse(data.model_dump(mode="json", by_alias=True),
                        headers={"Content-Disposition": f'attachment; filename="{fname}"'})


@router.post("/import", response_model=ImportResult)
def import_data(body: ExportV1, user: CurrentUser, db: DB,
                mode: Literal["merge", "replace"] = Query(default="merge")):
    return transfer_svc.import_(db, user, body, mode)
