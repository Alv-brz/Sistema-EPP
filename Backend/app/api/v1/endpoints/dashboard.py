from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_current_user, get_db, require_roles
from app.models.user import UserRole
from app.api.v1.endpoints.detections import to_public
from app.schemas.dashboard import DashboardStats, ReportMetric, ReportResponse
from app.services.export_service import build_report_pdf, build_report_xlsx, csv_bytes
from app.services.video_stream_service import video_stream_manager


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
    for key in ("created_at", "timestamp"):
        value = document.get(key)
        if isinstance(value, datetime) and value.tzinfo is None:
            document[key] = value.replace(tzinfo=UTC)
    return document


def detection_area_name(item: dict) -> str:
    return item.get("area_name") or item.get("location") or "Sin ubicacion"


def dated_filename(prefix: str, extension: str) -> str:
    return f"{prefix}_{datetime.now(UTC).strftime('%Y%m%d')}.{extension}"


def attachment_response(content: bytes, media_type: str, filename: str) -> Response:
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


async def build_report_response(db: AsyncIOMotorDatabase, report_range: str) -> ReportResponse:
    today = start_of_today()
    range_days = {"7d": 7, "30d": 30, "90d": 90}.get(report_range)
    since = today - timedelta(days=(range_days - 1)) if range_days else None
    query = {"created_at": {"$gte": since}} if since else {}
    items = await db.detections.find(query).to_list(length=10000)
    total_cameras = await db.cameras.count_documents({})
    violations = [item for item in items if item.get("missing_epps")]
    people_total = sum(person_count(item.get("detections", [])) for item in items)
    compliance = 100 if not items else round(((len(items) - len(violations)) / len(items)) * 100, 1)

    day_labels = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"]
    violations_by_day = []
    chart_days = range_days or 30
    for days_ago in range(chart_days - 1, -1, -1):
        day = today - timedelta(days=days_ago)
        next_day = day + timedelta(days=1)
        count = sum(1 for item in violations if day <= item["created_at"].replace(tzinfo=UTC) < next_day)
        label = day_labels[day.weekday()] if chart_days <= 7 else day.strftime("%d/%m")
        violations_by_day.append({"day": label, "violations": count})

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


@router.get("/dashboard/stats", response_model=DashboardStats)
async def dashboard_stats(
    _: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> DashboardStats:
    today = start_of_today()
    total_cameras = await db.cameras.count_documents({})
    camera_items = await db.cameras.find({}, {"_id": 1}).to_list(length=1000)
    active_cameras = sum(1 for camera in camera_items if video_stream_manager.is_streaming(str(camera["_id"])))
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
    report_range: str = Query(default="7d", alias="range"),
    _: dict = Depends(require_roles(UserRole.admin, UserRole.supervisor)),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> ReportResponse:
    return await build_report_response(db, report_range)


@router.get("/reports/export/pdf")
async def export_reports_pdf(
    report_range: str = Query(default="7d", alias="range"),
    current_user: dict = Depends(require_roles(UserRole.admin, UserRole.supervisor)),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Response:
    summary = await build_report_response(db, report_range)
    content = build_report_pdf(summary.model_dump(), current_user.get("name", current_user.get("email", "")), report_range)
    return attachment_response(content, "application/pdf", dated_filename("reporte_epp", "pdf"))


@router.get("/reports/export/excel")
async def export_reports_excel(
    report_range: str = Query(default="7d", alias="range"),
    current_user: dict = Depends(require_roles(UserRole.admin, UserRole.supervisor)),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Response:
    summary = await build_report_response(db, report_range)
    content = build_report_xlsx(summary.model_dump(), current_user.get("name", current_user.get("email", "")), report_range)
    return attachment_response(
        content,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        dated_filename("reporte_epp", "xlsx"),
    )


@router.get("/reports/export/csv")
async def export_reports_csv(
    report_range: str = Query(default="7d", alias="range"),
    _: dict = Depends(require_roles(UserRole.admin, UserRole.supervisor)),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Response:
    summary = (await build_report_response(db, report_range)).model_dump()
    rows: list[list[object]] = [
        ["Rango", report_range],
        ["Seccion", "Etiqueta", "Valor"],
        *[["Metricas", item["label"], item["value"]] for item in summary["stats"]],
        *[["Infracciones por dia", item["day"], item["violations"]] for item in summary["violations_by_day"]],
        *[["Infracciones por EPP", item["name"], item["value"]] for item in summary["violations_by_epp"]],
        *[["Cumplimiento por zona", item["area"], f'{item["compliance"]}%'] for item in summary["compliance_by_area"]],
    ]
    return attachment_response(csv_bytes(rows), "text/csv; charset=utf-8", dated_filename("reporte_epp", "csv"))
