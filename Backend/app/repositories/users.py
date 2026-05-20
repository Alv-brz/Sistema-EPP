from datetime import UTC, datetime

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.security import get_password_hash
from app.models.user import UserRole


def serialize_user(document: dict | None) -> dict | None:
    if not document:
        return None
    document = dict(document)
    document["id"] = str(document.pop("_id"))
    return document


class UserRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.collection = db.users

    async def get_by_id(self, user_id: str) -> dict | None:
        if not ObjectId.is_valid(user_id):
            return None
        return serialize_user(await self.collection.find_one({"_id": ObjectId(user_id)}))

    async def get_by_email(self, email: str) -> dict | None:
        return serialize_user(await self.collection.find_one({"email": email.lower()}))

    async def create(self, email: str, name: str, password: str, role: UserRole) -> dict:
        now = datetime.now(UTC)
        document = {
            "email": email.lower(),
            "name": name,
            "role": role.value,
            "hashed_password": get_password_hash(password),
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        }
        result = await self.collection.insert_one(document)
        created = await self.collection.find_one({"_id": result.inserted_id})
        serialized = serialize_user(created)
        if serialized is None:
            raise RuntimeError("Created user could not be loaded")
        return serialized

    async def list(self, limit: int = 100, offset: int = 0) -> list[dict]:
        cursor = self.collection.find().sort("created_at", -1).skip(offset).limit(limit)
        return [serialize_user(document) async for document in cursor if document]

    async def update(self, user_id: str, data: dict) -> dict | None:
        if not ObjectId.is_valid(user_id):
            return None
        update_data = {key: value for key, value in data.items() if value is not None}
        if "password" in update_data:
            update_data["hashed_password"] = get_password_hash(update_data.pop("password"))
        if "role" in update_data and hasattr(update_data["role"], "value"):
            update_data["role"] = update_data["role"].value
        update_data["updated_at"] = datetime.now(UTC)
        await self.collection.update_one({"_id": ObjectId(user_id)}, {"$set": update_data})
        return await self.get_by_id(user_id)

    async def delete(self, user_id: str) -> bool:
        if not ObjectId.is_valid(user_id):
            return False
        result = await self.collection.delete_one({"_id": ObjectId(user_id)})
        return result.deleted_count == 1

    async def ensure_default_admin(self, email: str, name: str, password: str) -> None:
        existing = await self.get_by_email(email)
        if existing:
            return
        await self.create(email=email, name=name, password=password, role=UserRole.admin)
