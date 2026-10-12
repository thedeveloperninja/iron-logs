from fastapi import APIRouter

from app.api.routes import admin, auth, body, exercises, routines, transfer, workouts

api_router = APIRouter(prefix="/api/v1")
for module in (auth, exercises, routines, workouts, body, transfer, admin):
    api_router.include_router(module.router)
