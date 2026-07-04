from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel


class CameraStatus(StrEnum):
    online = "online"
    offline = "offline"


class CameraSourceType(StrEnum):
    webcam = "webcam"
    rtsp = "rtsp"


class CameraPublic(BaseModel):
    id: str
    code: str
    name: str
    location: str
    area_id: str | None = None
    area_name: str | None = None
    ip: str
    status: CameraStatus
    source_type: CameraSourceType = CameraSourceType.webcam
    source_url: str | None = None
    is_streaming: bool = False
    resolution: str
    fps: int
    created_at: datetime
    updated_at: datetime


class CameraCreate(BaseModel):
    name: str
    location: str = ""
    area_id: str | None = None
    area_name: str | None = None
    ip: str
    status: CameraStatus = CameraStatus.online
    source_type: CameraSourceType = CameraSourceType.webcam
    source_url: str | None = "0"
    resolution: str = "1920x1080"
    fps: int = 30


class CameraUpdate(BaseModel):
    name: str | None = None
    location: str | None = None
    area_id: str | None = None
    area_name: str | None = None
    ip: str | None = None
    status: CameraStatus | None = None
    source_type: CameraSourceType | None = None
    source_url: str | None = None
    resolution: str | None = None
    fps: int | None = None


class WebcamDevice(BaseModel):
    index: int
    name: str
    source_url: str
    in_use: bool = False
