from fastapi import HTTPException, status

from app.core.security import create_access_token, verify_password
from app.repositories.users import UserRepository


class AuthService:
    def __init__(self, users: UserRepository):
        self.users = users

    async def authenticate(self, email: str, password: str) -> tuple[str, dict]:
        user = await self.users.get_by_email(email)
        if not user or not user["is_active"]:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
        if not verify_password(password, user["hashed_password"]):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
        token = create_access_token(subject=user["id"], extra_claims={"role": user["role"]})
        return token, user
