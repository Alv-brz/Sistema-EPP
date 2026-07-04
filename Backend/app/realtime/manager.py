import asyncio
import contextlib
import logging
import queue

from fastapi import WebSocket, WebSocketDisconnect
from fastapi.encoders import jsonable_encoder


logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []
        self._loop: asyncio.AbstractEventLoop | None = None
        self._thread_queue: queue.Queue[dict] = queue.Queue()
        self._relay_task: asyncio.Task | None = None

    async def start(self) -> None:
        if not self._relay_task or self._relay_task.done():
            self._relay_task = asyncio.create_task(self._relay_loop())

    async def stop(self) -> None:
        if self._relay_task:
            self._relay_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._relay_task
            self._relay_task = None

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._loop = asyncio.get_running_loop()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast_json(self, message: dict) -> None:
        payload = jsonable_encoder(message)
        stale_connections: list[WebSocket] = []
        for connection in list(self.active_connections):
            try:
                await connection.send_json(payload)
            except (RuntimeError, WebSocketDisconnect):
                stale_connections.append(connection)
            except Exception:
                logger.exception("Could not send realtime event")
                stale_connections.append(connection)
        for connection in stale_connections:
            self.disconnect(connection)

    def broadcast_json_threadsafe(self, message: dict) -> bool:
        if not self._loop or self._loop.is_closed():
            return False
        future = asyncio.run_coroutine_threadsafe(self.broadcast_json(message), self._loop)
        future.add_done_callback(self._log_broadcast_error)
        return True

    def enqueue_json(self, message: dict) -> None:
        self._thread_queue.put(message)

    async def _relay_loop(self) -> None:
        while True:
            while True:
                try:
                    message = self._thread_queue.get_nowait()
                except queue.Empty:
                    break
                try:
                    await self.broadcast_json(message)
                except Exception:
                    logger.exception("Could not relay queued realtime event")
            await asyncio.sleep(0.1)

    @staticmethod
    def _log_broadcast_error(future: asyncio.Future) -> None:
        try:
            future.result()
        except Exception:
            logger.exception("Could not broadcast realtime event")


manager = ConnectionManager()
