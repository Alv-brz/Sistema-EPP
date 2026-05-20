from pydantic import BaseModel

from app.schemas.detection import DetectionPublic


class DashboardStats(BaseModel):
    total_cameras: int
    active_cameras: int
    total_violations_today: int
    active_alerts: int
    compliance: int
    people_detected_today: int
    people_currently_in_area: int
    recent_violations: list[DetectionPublic]


class ReportMetric(BaseModel):
    label: str
    value: str
    change: str
    trend: str


class ReportResponse(BaseModel):
    stats: list[ReportMetric]
    violations_by_day: list[dict]
    violations_by_epp: list[dict]
    compliance_by_area: list[dict]
