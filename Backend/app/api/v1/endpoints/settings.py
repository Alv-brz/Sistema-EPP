from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_yolo_settings_repository, require_roles
from app.models.user import UserRole
from app.repositories.yolo_settings import YoloSettingsRepository
from app.schemas.yolo_settings import (
    GeneralSettingsPublic,
    GeneralSettingsUpdate,
    YoloSettingsPublic,
    YoloSettingsUpdate,
)


router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/yolo", response_model=YoloSettingsPublic)
async def get_yolo_settings(
    _: dict = Depends(require_roles(UserRole.admin)),
    settings: YoloSettingsRepository = Depends(get_yolo_settings_repository),
) -> YoloSettingsPublic:
    return YoloSettingsPublic(**await settings.get())


@router.put("/yolo", response_model=YoloSettingsPublic)
async def update_yolo_settings(
    payload: YoloSettingsUpdate,
    _: dict = Depends(require_roles(UserRole.admin)),
    settings: YoloSettingsRepository = Depends(get_yolo_settings_repository),
) -> YoloSettingsPublic:
    try:
        updated = await settings.update(payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return YoloSettingsPublic(**updated)


@router.get("/general", response_model=GeneralSettingsPublic)
async def get_general_settings(
    _: dict = Depends(require_roles(UserRole.admin, UserRole.supervisor, UserRole.inspector)),
    settings: YoloSettingsRepository = Depends(get_yolo_settings_repository),
) -> GeneralSettingsPublic:
    return GeneralSettingsPublic(**await settings.get_general())


@router.put("/general", response_model=GeneralSettingsPublic)
async def update_general_settings(
    payload: GeneralSettingsUpdate,
    _: dict = Depends(require_roles(UserRole.admin)),
    settings: YoloSettingsRepository = Depends(get_yolo_settings_repository),
) -> GeneralSettingsPublic:
    return GeneralSettingsPublic(**await settings.update_general(payload.model_dump()))
