from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from app.api.deps import get_camera_repository, require_roles
from app.core.config import Settings, get_settings
from app.core.security import decode_access_token
from app.models.user import UserRole
from app.repositories.cameras import CameraRepository
from app.schemas.camera import CameraCreate, CameraPublic, CameraUpdate
from app.services.video_stream_service import video_stream_manager


router = APIRouter(prefix="/cameras", tags=["cameras"])


def with_stream_state(camera: dict) -> CameraPublic:
    return CameraPublic(**camera, is_streaming=video_stream_manager.is_streaming(camera["id"]))


def validate_stream_token(token: str) -> None:
    try:
        decode_access_token(token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid stream token") from exc


@router.get("", response_model=list[CameraPublic])
async def list_cameras(
    _: dict = Depends(require_roles(UserRole.admin, UserRole.supervisor, UserRole.inspector)),
    cameras: CameraRepository = Depends(get_camera_repository),
) -> list[CameraPublic]:
    return [with_stream_state(camera) for camera in await cameras.list()]


@router.post("", response_model=CameraPublic, status_code=status.HTTP_201_CREATED)
async def create_camera(
    payload: CameraCreate,
    _: dict = Depends(require_roles(UserRole.admin, UserRole.supervisor)),
    cameras: CameraRepository = Depends(get_camera_repository),
) -> CameraPublic:
    try:
        created = await cameras.create(payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return with_stream_state(created)


@router.patch("/{camera_id}", response_model=CameraPublic)
async def update_camera(
    camera_id: str,
    payload: CameraUpdate,
    _: dict = Depends(require_roles(UserRole.admin, UserRole.supervisor)),
    cameras: CameraRepository = Depends(get_camera_repository),
) -> CameraPublic:
    try:
        updated = await cameras.update(camera_id, payload.model_dump(exclude_unset=True))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found")
    return with_stream_state(updated)


@router.delete("/{camera_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_camera(
    camera_id: str,
    _: dict = Depends(require_roles(UserRole.admin)),
    cameras: CameraRepository = Depends(get_camera_repository),
) -> None:
    deleted = await cameras.delete(camera_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found")


@router.post("/{camera_id}/start", response_model=CameraPublic)
async def start_camera(
    camera_id: str,
    _: dict = Depends(require_roles(UserRole.admin, UserRole.supervisor, UserRole.inspector)),
    cameras: CameraRepository = Depends(get_camera_repository),
    settings: Settings = Depends(get_settings),
) -> CameraPublic:
    camera = await cameras.get_by_id(camera_id)
    if not camera:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found")
    try:
        video_stream_manager.start(
            camera_id=camera["id"],
            camera_code=camera["code"],
            location=camera.get("location"),
            area_id=camera.get("area_id"),
            area_name=camera.get("area_name"),
            source_type=camera.get("source_type", "webcam"),
            source_url=camera.get("source_url"),
            ip=camera.get("ip"),
            fps=camera.get("fps", 30),
            settings=settings,
        )
    except RuntimeError as exc:
        await cameras.update(camera_id, {"status": "offline"})
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    updated = await cameras.update(camera_id, {"status": "online"})
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found")
    return with_stream_state(updated)


@router.post("/{camera_id}/stop", response_model=CameraPublic)
async def stop_camera(
    camera_id: str,
    _: dict = Depends(require_roles(UserRole.admin, UserRole.supervisor, UserRole.inspector)),
    cameras: CameraRepository = Depends(get_camera_repository),
) -> CameraPublic:
    video_stream_manager.stop(camera_id)
    updated = await cameras.update(camera_id, {"status": "offline"})
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found")
    return with_stream_state(updated)


@router.get("/{camera_id}/stream")
async def stream_camera(
    camera_id: str,
    token: str = Query(...),
    cameras: CameraRepository = Depends(get_camera_repository),
) -> StreamingResponse:
    validate_stream_token(token)
    camera = await cameras.get_by_id(camera_id)
    if not camera:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found")
    if not video_stream_manager.is_streaming(camera_id):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Camera is not streaming")
    return StreamingResponse(
        video_stream_manager.frame_generator(camera_id),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )
