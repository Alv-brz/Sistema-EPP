from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_area_service, require_roles
from app.models.user import UserRole
from app.schemas.area import AreaCreate, AreaPublic, AreaUpdate
from app.services.area_service import AreaService


router = APIRouter(prefix="/areas", tags=["areas"])


@router.get("", response_model=list[AreaPublic])
async def list_areas(
    _: dict = Depends(require_roles(UserRole.admin, UserRole.supervisor, UserRole.inspector)),
    service: AreaService = Depends(get_area_service),
) -> list[AreaPublic]:
    return [AreaPublic(**area) for area in await service.list()]


@router.get("/{area_id}", response_model=AreaPublic)
async def get_area(
    area_id: str,
    _: dict = Depends(require_roles(UserRole.admin)),
    service: AreaService = Depends(get_area_service),
) -> AreaPublic:
    area = await service.get(area_id)
    if not area:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Area not found")
    return AreaPublic(**area)


@router.post("", response_model=AreaPublic, status_code=status.HTTP_201_CREATED)
async def create_area(
    payload: AreaCreate,
    _: dict = Depends(require_roles(UserRole.admin)),
    service: AreaService = Depends(get_area_service),
) -> AreaPublic:
    return AreaPublic(**await service.create(payload.model_dump()))


@router.put("/{area_id}", response_model=AreaPublic)
async def update_area(
    area_id: str,
    payload: AreaUpdate,
    _: dict = Depends(require_roles(UserRole.admin)),
    service: AreaService = Depends(get_area_service),
) -> AreaPublic:
    area = await service.update(area_id, payload.model_dump())
    if not area:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Area not found")
    return AreaPublic(**area)


@router.delete("/{area_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_area(
    area_id: str,
    _: dict = Depends(require_roles(UserRole.admin)),
    service: AreaService = Depends(get_area_service),
) -> None:
    deleted = await service.delete(area_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Area not found")
