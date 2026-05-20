from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from app.api.deps import get_current_user, get_detection_repository, get_detection_service, require_roles
from app.models.user import UserRole
from app.repositories.detections import DetectionRepository
from app.schemas.detection import DetectionListResponse, DetectionPublic
from app.services.detection_service import DetectionService


router = APIRouter(prefix="/detections", tags=["detections"])


def to_public(document: dict) -> DetectionPublic:
    detection_id = document["id"]
    image_path = document.get("image_path")
    annotated_path = document.get("annotated_image_path")
    return DetectionPublic(
        **document,
        image_url=f"/api/v1/detections/{detection_id}/image" if image_path else None,
        annotated_image_url=f"/api/v1/detections/{detection_id}/annotated-image" if annotated_path else None,
    )


@router.post("/upload", response_model=DetectionPublic, status_code=status.HTTP_201_CREATED)
async def upload_detection_image(
    file: UploadFile = File(...),
    camera_id: str | None = Form(default=None),
    location: str | None = Form(default=None),
    current_user: dict = Depends(require_roles(UserRole.admin, UserRole.supervisor, UserRole.inspector)),
    service: DetectionService = Depends(get_detection_service),
) -> DetectionPublic:
    saved = await service.process_upload(file=file, created_by=current_user["id"], camera_id=camera_id, location=location)
    return to_public(saved)


@router.get("/history", response_model=DetectionListResponse)
async def detection_history(
    limit: int = 50,
    offset: int = 0,
    camera_id: str | None = None,
    _: dict = Depends(get_current_user),
    repository: DetectionRepository = Depends(get_detection_repository),
) -> DetectionListResponse:
    limit = min(max(limit, 1), 200)
    offset = max(offset, 0)
    items, total = await repository.list(limit=limit, offset=offset, camera_id=camera_id)
    return DetectionListResponse(items=[to_public(item) for item in items], total=total, limit=limit, offset=offset)


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
