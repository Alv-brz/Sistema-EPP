from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_user_repository, require_roles
from app.models.user import UserRole
from app.repositories.users import UserRepository
from app.schemas.user import UserCreate, UserPublic, UserUpdate


router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserPublic])
async def list_users(
    _: dict = Depends(require_roles(UserRole.admin, UserRole.supervisor)),
    users: UserRepository = Depends(get_user_repository),
) -> list[UserPublic]:
    return [UserPublic(**user) for user in await users.list()]


@router.post("", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    _: dict = Depends(require_roles(UserRole.admin)),
    users: UserRepository = Depends(get_user_repository),
) -> UserPublic:
    existing = await users.get_by_email(payload.email)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")
    created = await users.create(payload.email, payload.name, payload.password, payload.role)
    return UserPublic(**created)


@router.patch("/{user_id}", response_model=UserPublic)
async def update_user(
    user_id: str,
    payload: UserUpdate,
    _: dict = Depends(require_roles(UserRole.admin)),
    users: UserRepository = Depends(get_user_repository),
) -> UserPublic:
    updated = await users.update(user_id, payload.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserPublic(**updated)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    _: dict = Depends(require_roles(UserRole.admin)),
    users: UserRepository = Depends(get_user_repository),
) -> None:
    deleted = await users.delete(user_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
