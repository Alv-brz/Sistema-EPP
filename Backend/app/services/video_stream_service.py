import logging
import threading
import time
from collections.abc import Generator
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from pymongo import MongoClient

from app.core.config import Settings
from app.realtime.manager import manager
from app.services.detector_service import DetectorService


logger = logging.getLogger(__name__)


def _load_cv2() -> Any:
    try:
        import cv2
    except ImportError as exc:
        raise RuntimeError("opencv-python-headless is not installed") from exc
    return cv2


def normalize_source(source_type: str, source_url: str | None, ip: str | None = None) -> int | str:
    if source_type == "webcam":
        try:
            return int(source_url or 0)
        except ValueError:
            return 0
    if source_url:
        return source_url
    if ip:
        return f"rtsp://{ip}/stream1"
    raise ValueError("RTSP cameras require a source URL")


@dataclass
class VideoWorker:
    camera_id: str
    camera_code: str
    location: str | None
    area_id: str | None
    area_name: str | None
    source: int | str
    fps: int
    capture: Any
    detector: DetectorService
    settings: Settings
    mongo_uri: str
    mongo_db: str
    lock: threading.Lock = field(default_factory=threading.Lock)
    frame: bytes | None = None
    running: bool = True
    thread: threading.Thread | None = None
    frame_index: int = 0
    last_saved_at: float = 0

    def start(self) -> None:
        self.thread = threading.Thread(target=self._read_loop, name=f"camera-{self.camera_id}", daemon=True)
        self.thread.start()

    def _read_loop(self) -> None:
        cv2 = _load_cv2()
        delay = 1 / max(self.fps, 1)
        client = MongoClient(self.mongo_uri)
        detections_collection = client[self.mongo_db].detections
        while self.running:
            ok, frame = self.capture.read()
            if ok:
                self.frame_index += 1
                processed_frame = frame
                prediction: dict[str, Any] | None = None
                if self.frame_index % max(self.settings.detector_frame_skip, 1) == 0:
                    try:
                        prediction = self.detector.predict_frame(frame)
                        processed_frame = prediction["frame"]
                    except Exception:
                        logger.exception("YOLO detection failed for camera %s", self.camera_code)
                        processed_frame = frame
                    if prediction:
                        try:
                            self._persist_prediction(prediction, detections_collection)
                        except Exception:
                            logger.exception("Could not persist detection for camera %s", self.camera_code)
                encoded_ok, buffer = cv2.imencode(".jpg", processed_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
                if encoded_ok:
                    with self.lock:
                        self.frame = buffer.tobytes()
            time.sleep(delay)
        client.close()
        self.capture.release()

    def _persist_prediction(self, prediction: dict[str, Any], collection: Any) -> None:
        has_relevant_detection = bool(prediction["detected_classes"])
        has_infraction = bool(prediction["missing_epps"])
        if not has_relevant_detection and not has_infraction:
            return
        now = time.monotonic()
        if now - self.last_saved_at < max(self.settings.detector_save_interval_seconds, 1):
            return
        self.last_saved_at = now
        timestamp = datetime.now(UTC)
        document = {
            "camera_id": self.camera_id,
            "camera_code": self.camera_code,
            "camera_object_id": self.camera_id,
            "area_id": self.area_id,
            "area_name": self.area_name,
            "location": self.location,
            "timestamp": timestamp,
            "image_path": None,
            "annotated_image_path": None,
            "detections": prediction["detections"],
            "detected_classes": prediction["detected_classes"],
            "missing_epps": prediction["missing_epps"],
            "severity": prediction["severity"],
            "confidence_threshold": prediction["confidence_threshold"],
            "processed_ms": prediction["processed_ms"],
            "created_by": "camera-stream",
            "created_at": timestamp,
        }
        result = collection.insert_one(document)
        saved = {key: value for key, value in document.items() if key != "_id"}
        saved["id"] = str(result.inserted_id)
        self._broadcast_detection(saved)

    def _broadcast_detection(self, detection: dict[str, Any]) -> None:
        manager.enqueue_json({"event": "detection.created", "data": detection})

    def stop(self) -> None:
        self.running = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=2)

    def latest_frame(self) -> bytes | None:
        with self.lock:
            return self.frame


class VideoStreamManager:
    def __init__(self) -> None:
        self._workers: dict[str, VideoWorker] = {}
        self._lock = threading.Lock()
        self._detector: DetectorService | None = None

    def is_streaming(self, camera_id: str) -> bool:
        worker = self._workers.get(camera_id)
        return bool(worker and worker.running)

    def start(
        self,
        camera_id: str,
        camera_code: str,
        location: str | None,
        area_id: str | None,
        area_name: str | None,
        source_type: str,
        source_url: str | None,
        ip: str | None,
        fps: int,
        settings: Settings,
    ) -> None:
        with self._lock:
            if self.is_streaming(camera_id):
                return
            cv2 = _load_cv2()
            source = normalize_source(source_type, source_url, ip)
            capture = cv2.VideoCapture(source)
            if not capture.isOpened():
                capture.release()
                raise RuntimeError(f"Could not open camera source: {source}")
            if self._detector is None:
                self._detector = DetectorService(settings)
            worker = VideoWorker(
                camera_id=camera_id,
                camera_code=camera_code,
                location=location,
                area_id=area_id,
                area_name=area_name,
                source=source,
                fps=fps,
                capture=capture,
                detector=self._detector,
                settings=settings,
                mongo_uri=settings.mongodb_uri,
                mongo_db=settings.mongodb_db,
            )
            self._workers[camera_id] = worker
            worker.start()

    def stop(self, camera_id: str) -> None:
        with self._lock:
            worker = self._workers.pop(camera_id, None)
        if worker:
            worker.stop()

    def stop_all(self) -> None:
        with self._lock:
            workers = list(self._workers.values())
            self._workers.clear()
        for worker in workers:
            worker.stop()

    def frame_generator(self, camera_id: str) -> Generator[bytes, None, None]:
        while self.is_streaming(camera_id):
            worker = self._workers.get(camera_id)
            frame = worker.latest_frame() if worker else None
            if frame:
                yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + frame + b"\r\n"
            time.sleep(0.04)


video_stream_manager = VideoStreamManager()
