import asyncio
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect, status
from fastapi.encoders import jsonable_encoder
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_db
from app.core.security import decode_access_token
from app.realtime.manager import manager


router = APIRouter(prefix="/ws", tags=["websocket"])


def serialize_detection_event(document: dict[str, Any]) -> dict[str, Any]:
    document = dict(document)
    document["id"] = str(document.pop("_id"))
    for key in ("created_at", "timestamp"):
        value = document.get(key)
        if isinstance(value, datetime) and value.tzinfo is None:
            document[key] = value.replace(tzinfo=UTC)
    return document


def mongo_utc_now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def normalize_mongo_datetime(value: datetime) -> datetime:
    if value.tzinfo:
        return value.astimezone(UTC).replace(tzinfo=None)
    return value


@router.websocket("/detections")
async def detection_events(
    websocket: WebSocket,
    token: str | None = Query(default=None),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> None:
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    try:
        decode_access_token(token)
    except ValueError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(websocket)
    last_stream_detection_at = mongo_utc_now()
    try:
        while True:
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=1)
            except TimeoutError:
                stream_items = await db.detections.find(
                    {
                        "created_by": "camera-stream",
                        "created_at": {"$gt": last_stream_detection_at},
                    }
                ).sort("created_at", 1).limit(20).to_list(length=20)
                for item in stream_items:
                    created_at = item.get("created_at")
                    if isinstance(created_at, datetime):
                        last_stream_detection_at = max(last_stream_detection_at, normalize_mongo_datetime(created_at))
                    await websocket.send_json(
                        jsonable_encoder(
                            {
                                "event": "detection.created",
                                "data": serialize_detection_event(item),
                            }
                        )
                    )
    except WebSocketDisconnect:
        manager.disconnect(websocket)
