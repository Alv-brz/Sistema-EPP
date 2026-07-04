from pathlib import Path
from datetime import UTC, datetime

from fastapi import UploadFile

from app.repositories.detections import DetectionRepository
from app.realtime.manager import manager
from app.services.detector_service import DetectorService
from app.services.storage import StorageService


class DetectionService:
    def __init__(
        self,
        detections: DetectionRepository,
        detector: DetectorService,
        storage: StorageService,
    ):
        self.detections = detections
        self.detector = detector
        self.storage = storage

    async def process_upload(
        self,
        file: UploadFile,
        created_by: str,
        camera_id: str | None = None,
        camera_code: str | None = None,
        camera_object_id: str | None = None,
        area_id: str | None = None,
        area_name: str | None = None,
        location: str | None = None,
    ) -> dict:
        image_path = await self.storage.save_upload(file)
        annotated_path = self.storage.annotated_path_for(Path(image_path))
        prediction = self.detector.predict(image_path=image_path, annotated_path=annotated_path)
        timestamp = datetime.now(UTC)
        saved = await self.detections.create(
            {
                "camera_id": camera_id,
                "camera_code": camera_code,
                "camera_object_id": camera_object_id,
                "area_id": area_id,
                "area_name": area_name,
                "location": location,
                "timestamp": timestamp,
                "image_path": str(image_path),
                "annotated_image_path": prediction["annotated_image_path"],
                "detections": prediction["detections"],
                "detected_classes": prediction["detected_classes"],
                "missing_epps": prediction["missing_epps"],
                "severity": prediction["severity"],
                "confidence_threshold": prediction["confidence_threshold"],
                "processed_ms": prediction["processed_ms"],
                "created_by": created_by,
            }
        )
        await manager.broadcast_json({"event": "detection.created", "data": saved})
        return saved
