from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, EmailStr, Field


class UserRole(StrEnum):
    admin = "admin"
    supervisor = "supervisor"
    inspector = "inspector"


class UserInDB(BaseModel):
    id: str = Field(alias="_id")
    email: EmailStr
    name: str
    role: UserRole
    hashed_password: str
    is_active: bool = True
    created_at: datetime
    updated_at: datetime
