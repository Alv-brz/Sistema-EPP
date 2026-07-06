from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.models.detection import DetectionSeverity


class DetectionItem(BaseModel):
    label: str
    confidence: float
    box: list[float]


class DetectionPublic(BaseModel):
    id: str
    camera_id: str | None = None
    camera_code: str | None = None
    camera_object_id: str | None = None
    area_id: str | None = None
    area_name: str | None = None
    location: str | None = None
    image_url: str | None = None
    annotated_image_url: str | None = None
    detections: list[dict[str, Any]]
    detected_classes: list[str] = []
    detected_objects: list[str] = []
    missing_epps: list[str]
    severity: DetectionSeverity
    confidence_threshold: float
    processed_ms: int
    created_by: str
    timestamp: datetime | None = None
    created_at: datetime


class DetectionListResponse(BaseModel):
    items: list[DetectionPublic]
    total: int
    page: int = 1
    limit: int
    offset: int
    totalPages: int = 1
