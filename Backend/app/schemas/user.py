from datetime import datetime

from pydantic import BaseModel, EmailStr

from app.models.user import UserRole


class UserPublic(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: UserRole
    is_active: bool
    created_at: datetime


class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str
    role: UserRole = UserRole.inspector


class UserUpdate(BaseModel):
    name: str | None = None
    password: str | None = None
    role: UserRole | None = None
    is_active: bool | None = None
