from collections.abc import Callable
from functools import lru_cache

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import Settings, get_settings
from app.core.security import decode_access_token
from app.db.mongodb import get_database
from app.models.user import UserRole
from app.repositories.areas import AreaRepository
from app.repositories.cameras import CameraRepository
from app.repositories.detections import DetectionRepository
from app.repositories.users import UserRepository
from app.repositories.yolo_settings import YoloSettingsRepository
from app.services.area_service import AreaService
from app.services.detector_service import DetectorService
from app.services.detection_service import DetectionService
from app.services.storage import StorageService


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_db() -> AsyncIOMotorDatabase:
    return get_database()


def get_user_repository(db: AsyncIOMotorDatabase = Depends(get_db)) -> UserRepository:
    return UserRepository(db)


def get_detection_repository(db: AsyncIOMotorDatabase = Depends(get_db)) -> DetectionRepository:
    return DetectionRepository(db)


def get_area_repository(db: AsyncIOMotorDatabase = Depends(get_db)) -> AreaRepository:
    return AreaRepository(db)


def get_area_service(areas: AreaRepository = Depends(get_area_repository)) -> AreaService:
    return AreaService(areas)


def get_camera_repository(db: AsyncIOMotorDatabase = Depends(get_db)) -> CameraRepository:
    return CameraRepository(db)


def get_yolo_settings_repository(db: AsyncIOMotorDatabase = Depends(get_db)) -> YoloSettingsRepository:
    return YoloSettingsRepository(db)


@lru_cache
def get_cached_detector_service() -> DetectorService:
    return DetectorService(get_settings())


def get_detector_service() -> DetectorService:
    return get_cached_detector_service()


def get_storage_service(settings: Settings = Depends(get_settings)) -> StorageService:
    return StorageService(settings.upload_path, settings.annotated_path)


def get_detection_service(
    detections: DetectionRepository = Depends(get_detection_repository),
    detector: DetectorService = Depends(get_detector_service),
    storage: StorageService = Depends(get_storage_service),
) -> DetectionService:
    return DetectionService(detections=detections, detector=detector, storage=storage)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    users: UserRepository = Depends(get_user_repository),
) -> dict:
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = await users.get_by_id(user_id)
    if not user or not user["is_active"]:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive or missing user")
    return user


def require_roles(*roles: UserRole) -> Callable:
    async def dependency(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["role"] not in {role.value for role in roles}:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user

    return dependency
