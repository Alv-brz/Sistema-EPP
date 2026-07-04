from datetime import UTC, datetime, time
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse, Response
from pymongo.errors import PyMongoError

from app.api.deps import (
    get_camera_repository,
    get_current_user,
    get_detection_repository,
    get_detection_service,
    require_roles,
)
from app.models.user import UserRole
from app.repositories.cameras import CameraRepository
from app.repositories.detections import DetectionRepository
from app.schemas.detection import DetectionListResponse, DetectionPublic
from app.services.detection_service import DetectionService
from app.services.export_service import build_detections_pdf, build_detections_xlsx, csv_bytes, format_datetime


router = APIRouter(prefix="/detections", tags=["detections"])
logger = logging.getLogger(__name__)


def parse_date_filter(value: str | None, end_of_day: bool = False) -> datetime | None:
    if not value:
        return None
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo:
        parsed = parsed.astimezone(UTC).replace(tzinfo=None)
    if len(value) == 10:
        parsed = datetime.combine(parsed.date(), time.max if end_of_day else time.min)
    return parsed


def to_public(document: dict) -> DetectionPublic:
    detection_id = document["id"]
    image_path = document.get("image_path")
    annotated_path = document.get("annotated_image_path")
    return DetectionPublic(
        **document,
        image_url=f"/api/v1/detections/{detection_id}/image" if image_path else None,
        annotated_image_url=f"/api/v1/detections/{detection_id}/annotated-image" if annotated_path else None,
    )


def dated_filename(prefix: str, extension: str) -> str:
    return f"{prefix}_{datetime.now(UTC).strftime('%Y%m%d')}.{extension}"


def attachment_response(content: bytes, media_type: str, filename: str) -> Response:
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


async def list_filtered_detections_for_export(
    repository: DetectionRepository,
    camera_id: str | None = None,
    search: str | None = None,
    area: str | None = None,
    epp: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    violations_only: bool = True,
) -> list[dict]:
    items, _ = await repository.list(
        limit=50000,
        offset=0,
        camera_id=camera_id,
        search=search.strip() if search else None,
        area=area.strip() if area and area != "all" else None,
        epp=epp.strip() if epp and epp != "all" else None,
        date_from=parse_date_filter(date_from),
        date_to=parse_date_filter(date_to, end_of_day=True),
        violations_only=violations_only,
    )
    return items


@router.post("/upload", response_model=DetectionPublic, status_code=status.HTTP_201_CREATED)
async def upload_detection_image(
    file: UploadFile = File(...),
    camera_id: str | None = Form(default=None),
    location: str | None = Form(default=None),
    current_user: dict = Depends(require_roles(UserRole.admin, UserRole.supervisor, UserRole.inspector)),
    service: DetectionService = Depends(get_detection_service),
    cameras: CameraRepository = Depends(get_camera_repository),
) -> DetectionPublic:
    camera_code = None
    camera_object_id = None
    area_id = None
    area_name = None
    if camera_id:
        camera = await cameras.get_by_id(camera_id)
        if camera:
            camera_object_id = camera["id"]
            camera_code = camera.get("code")
            area_id = camera.get("area_id")
            area_name = camera.get("area_name")
            location = location or camera.get("location")
    saved = await service.process_upload(
        file=file,
        created_by=current_user["id"],
        camera_id=camera_id,
        camera_code=camera_code,
        camera_object_id=camera_object_id,
        area_id=area_id,
        area_name=area_name,
        location=location,
    )
    return to_public(saved)


@router.get("/history", response_model=DetectionListResponse)
async def detection_history(
    limit: int = 50,
    offset: int = 0,
    page: int | None = None,
    camera_id: str | None = None,
    search: str | None = None,
    area: str | None = None,
    epp: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    violations_only: bool = False,
    _: dict = Depends(get_current_user),
    repository: DetectionRepository = Depends(get_detection_repository),
) -> DetectionListResponse:
    limit = min(max(limit, 1), 200)
    current_page = max(page or ((offset // limit) + 1), 1)
    offset = (current_page - 1) * limit if page is not None else max(offset, 0)
    try:
        items, total = await repository.list(
            limit=limit,
            offset=offset,
            camera_id=camera_id,
            search=search.strip() if search else None,
            area=area.strip() if area and area != "all" else None,
            epp=epp.strip() if epp and epp != "all" else None,
            date_from=parse_date_filter(date_from),
            date_to=parse_date_filter(date_to, end_of_day=True),
            violations_only=violations_only,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid date filter") from exc
    except PyMongoError as exc:
        logger.exception("Could not load detection history")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database error loading detection history") from exc
    total_pages = max((total + limit - 1) // limit, 1)
    return DetectionListResponse(
        items=[to_public(item) for item in items],
        total=total,
        page=current_page,
        limit=limit,
        offset=offset,
        totalPages=total_pages,
    )


@router.get("/export/pdf")
async def export_detections_pdf(
    camera_id: str | None = None,
    search: str | None = None,
    area: str | None = None,
    epp: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    current_user: dict = Depends(require_roles(UserRole.admin, UserRole.supervisor)),
    repository: DetectionRepository = Depends(get_detection_repository),
) -> Response:
    items = await list_filtered_detections_for_export(repository, camera_id, search, area, epp, date_from, date_to)
    content = build_detections_pdf(items, current_user.get("name", current_user.get("email", "")))
    return attachment_response(content, "application/pdf", dated_filename("infracciones_epp", "pdf"))


@router.get("/export/excel")
async def export_detections_excel(
    camera_id: str | None = None,
    search: str | None = None,
    area: str | None = None,
    epp: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    current_user: dict = Depends(require_roles(UserRole.admin, UserRole.supervisor)),
    repository: DetectionRepository = Depends(get_detection_repository),
) -> Response:
    items = await list_filtered_detections_for_export(repository, camera_id, search, area, epp, date_from, date_to)
    content = build_detections_xlsx(items, current_user.get("name", current_user.get("email", "")))
    return attachment_response(
        content,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        dated_filename("infracciones_epp", "xlsx"),
    )


@router.get("/export/csv")
async def export_detections_csv(
    camera_id: str | None = None,
    search: str | None = None,
    area: str | None = None,
    epp: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    _: dict = Depends(require_roles(UserRole.admin, UserRole.supervisor)),
    repository: DetectionRepository = Depends(get_detection_repository),
) -> Response:
    items = await list_filtered_detections_for_export(repository, camera_id, search, area, epp, date_from, date_to)
    rows: list[list[object]] = [
        ["ID", "Camara", "Ubicacion", "Fecha/Hora", "EPP faltantes", "Severidad", "Estado"],
        *[
            [
                item.get("id", ""),
                item.get("camera_code") or item.get("camera_id") or "",
                item.get("area_name") or item.get("location") or "",
                format_datetime(item.get("created_at") or item.get("timestamp")),
                ", ".join(item.get("missing_epps", [])),
                item.get("severity", ""),
                item.get("status", "Nueva"),
            ]
            for item in items
        ],
    ]
    return attachment_response(csv_bytes(rows), "text/csv; charset=utf-8", dated_filename("infracciones_epp", "csv"))


@router.get("/{detection_id}", response_model=DetectionPublic)
async def get_detection(
    detection_id: str,
    _: dict = Depends(get_current_user),
    repository: DetectionRepository = Depends(get_detection_repository),
) -> DetectionPublic:
    item = await repository.get_by_id(detection_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Detection not found")
    return to_public(item)


@router.get("/{detection_id}/image")
async def get_detection_image(
    detection_id: str,
    _: dict = Depends(get_current_user),
    repository: DetectionRepository = Depends(get_detection_repository),
) -> FileResponse:
    item = await repository.get_by_id(detection_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Detection not found")
    image_path = item.get("image_path")
    if not image_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image file not stored for this detection")
    path = Path(image_path)
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image file not found")
    return FileResponse(path)


@router.get("/{detection_id}/annotated-image")
async def get_annotated_detection_image(
    detection_id: str,
    _: dict = Depends(get_current_user),
    repository: DetectionRepository = Depends(get_detection_repository),
) -> FileResponse:
    item = await repository.get_by_id(detection_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Detection not found")
    annotated = item.get("annotated_image_path")
    if not annotated or not Path(annotated).exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Annotated image file not found")
    return FileResponse(annotated)
