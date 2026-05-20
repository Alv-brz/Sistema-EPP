from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.realtime.manager import manager


router = APIRouter(prefix="/ws", tags=["websocket"])


@router.websocket("/detections")
async def detection_events(websocket: WebSocket) -> None:
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
