from fastapi import APIRouter

from app.api.v1.endpoints import areas, auth, cameras, dashboard, detections, health, settings, users, ws


api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(areas.router)
api_router.include_router(cameras.router)
api_router.include_router(detections.router)
api_router.include_router(dashboard.router)
api_router.include_router(settings.router)
api_router.include_router(ws.router)
