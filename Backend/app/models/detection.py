from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


class DetectionSeverity(StrEnum):
    low = "low"
    medium = "medium"
    high = "high"


class DetectionInDB(BaseModel):
    id: str = Field(alias="_id")
    camera_id: str | None = None
    area_id: str | None = None
    area_name: str | None = None
    location: str | None = None
    image_path: str | None = None
    annotated_image_path: str | None = None
    detections: list[dict[str, Any]]
    detected_classes: list[str] = []
    missing_epps: list[str]
    severity: DetectionSeverity
    confidence_threshold: float
    processed_ms: int
    created_by: str
    timestamp: datetime | None = None
    created_at: datetime
