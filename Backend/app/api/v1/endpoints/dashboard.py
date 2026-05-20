from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_current_user, get_db
from app.api.v1.endpoints.detections import to_public
from app.schemas.dashboard import DashboardStats, ReportMetric, ReportResponse


router = APIRouter(tags=["dashboard"])


def start_of_today() -> datetime:
    now = datetime.now(UTC)
    return datetime(now.year, now.month, now.day, tzinfo=UTC)


def person_count(detections: list[dict]) -> int:
    return sum(1 for item in detections if str(item.get("label", "")).lower() in {"person", "persona"})


def epp_display_name(epp: str) -> str:
    return {
        "casco": "Casco",
        "chaleco": "Chaleco",
        "guantes": "Guantes",
        "botas": "Botas",
        "lentes": "Lentes",
    }.get(epp, epp.replace("_", " ").title())


def serialize_detection(document: dict) -> dict:
    document = dict(document)
    document["id"] = str(document.pop("_id"))
    return document


def detection_area_name(item: dict) -> str:
    return item.get("area_name") or item.get("location") or "Sin ubicacion"


@router.get("/dashboard/stats", response_model=DashboardStats)
async def dashboard_stats(
    _: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> DashboardStats:
    today = start_of_today()
    total_cameras = await db.cameras.count_documents({})
    active_cameras = await db.cameras.count_documents({"status": "online"})
    todays_items = await db.detections.find({"created_at": {"$gte": today}}).to_list(length=1000)
    total_violations_today = sum(1 for item in todays_items if item.get("missing_epps"))
    active_alerts = sum(1 for item in todays_items if item.get("severity") in {"medium", "high"})
    people_detected_today = sum(person_count(item.get("detections", [])) for item in todays_items)
    compliance = 100 if not todays_items else round(((len(todays_items) - total_violations_today) / len(todays_items)) * 100)
    recent = await db.detections.find({"missing_epps.0": {"$exists": True}}).sort("created_at", -1).limit(5).to_list(length=5)
    return DashboardStats(
        total_cameras=total_cameras,
        active_cameras=active_cameras,
        total_violations_today=total_violations_today,
        active_alerts=active_alerts,
        compliance=compliance,
        people_detected_today=people_detected_today,
        people_currently_in_area=people_detected_today,
        recent_violations=[to_public(serialize_detection(item)) for item in recent],
    )


@router.get("/reports/summary", response_model=ReportResponse)
async def reports_summary(
    _: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> ReportResponse:
    today = start_of_today()
    since = today - timedelta(days=6)
    items = await db.detections.find({"created_at": {"$gte": since}}).to_list(length=5000)
    total_cameras = await db.cameras.count_documents({})
    violations = [item for item in items if item.get("missing_epps")]
    people_total = sum(person_count(item.get("detections", [])) for item in items)
    compliance = 100 if not items else round(((len(items) - len(violations)) / len(items)) * 100, 1)

    day_labels = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"]
    violations_by_day = []
    for days_ago in range(6, -1, -1):
        day = today - timedelta(days=days_ago)
        next_day = day + timedelta(days=1)
        count = sum(1 for item in violations if day <= item["created_at"].replace(tzinfo=UTC) < next_day)
        violations_by_day.append({"day": day_labels[day.weekday()], "violations": count})

    epp_counts: dict[str, int] = {}
    for item in violations:
        for epp in item.get("missing_epps", []):
            epp_counts[epp] = epp_counts.get(epp, 0) + 1
    colors = ["#ef4444", "#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899"]
    violations_by_epp = [
        {"name": epp_display_name(key), "value": value, "color": colors[index % len(colors)]}
        for index, (key, value) in enumerate(sorted(epp_counts.items(), key=lambda entry: entry[1], reverse=True))
    ]

    by_area: dict[str, dict[str, int]] = {}
    for item in items:
        area = detection_area_name(item)
        by_area.setdefault(area, {"total": 0, "violations": 0})
        by_area[area]["total"] += 1
        if item.get("missing_epps"):
            by_area[area]["violations"] += 1
    compliance_by_area = [
        {"area": area, "compliance": round(((data["total"] - data["violations"]) / data["total"]) * 100)}
        for area, data in by_area.items()
    ]

    return ReportResponse(
        stats=[
            ReportMetric(label="Infracciones Detectadas", value=str(len(violations)), change="0%", trend="up"),
            ReportMetric(label="Nivel de Cumplimiento", value=f"{compliance}%", change="0%", trend="down"),
            ReportMetric(label="Zonas Monitoreadas", value=str(total_cameras), change="0", trend="up"),
            ReportMetric(label="Trabajadores Detectados", value=str(people_total), change="0%", trend="up"),
        ],
        violations_by_day=violations_by_day,
        violations_by_epp=violations_by_epp,
        compliance_by_area=compliance_by_area,
    )
