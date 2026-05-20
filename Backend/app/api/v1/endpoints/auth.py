from fastapi import APIRouter, Depends

from app.api.deps import get_current_user, get_user_repository
from app.repositories.users import UserRepository
from app.schemas.auth import LoginRequest, TokenResponse
from app.schemas.user import UserPublic
from app.services.auth_service import AuthService


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, users: UserRepository = Depends(get_user_repository)) -> TokenResponse:
    token, user = await AuthService(users).authenticate(payload.email, payload.password)
    return TokenResponse(access_token=token, user=UserPublic(**user))


@router.get("/me", response_model=UserPublic)
async def me(current_user: dict = Depends(get_current_user)) -> UserPublic:
    return UserPublic(**current_user)
