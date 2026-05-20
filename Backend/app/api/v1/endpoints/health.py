from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_db


router = APIRouter(tags=["health"])


@router.get("/health")
async def health(db: AsyncIOMotorDatabase = Depends(get_db)) -> dict:
    await db.command("ping")
    return {"status": "ok", "mongodb": "ok"}
