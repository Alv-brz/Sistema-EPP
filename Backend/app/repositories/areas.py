from datetime import UTC, datetime

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase


def serialize_area(document: dict | None) -> dict | None:
    if not document:
        return None
    document = dict(document)
    document["id"] = str(document.pop("_id"))
    document["allowed_objects"] = document.get("allowed_objects", [])
    return document


class AreaRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.areas

    async def list(self) -> list[dict]:
        cursor = self.collection.find().sort("name", 1)
        return [serialize_area(document) async for document in cursor if document]

    async def get_by_id(self, area_id: str) -> dict | None:
        if not ObjectId.is_valid(area_id):
            return None
        return serialize_area(await self.collection.find_one({"_id": ObjectId(area_id)}))

    async def create(self, data: dict) -> dict:
        now = datetime.now(UTC)
        document = {
            "name": data["name"],
            "description": data.get("description", ""),
            "required_epps": [item.value if hasattr(item, "value") else item for item in data.get("required_epps", [])],
            "allowed_objects": [item.value if hasattr(item, "value") else item for item in data.get("allowed_objects", [])],
            "created_at": now,
            "updated_at": now,
        }
        result = await self.collection.insert_one(document)
        created = serialize_area(await self.collection.find_one({"_id": result.inserted_id}))
        if created is None:
            raise RuntimeError("Created area could not be loaded")
        return created

    async def update(self, area_id: str, data: dict) -> dict | None:
        if not ObjectId.is_valid(area_id):
            return None
        update_data = {
            "name": data["name"],
            "description": data.get("description", ""),
            "required_epps": [item.value if hasattr(item, "value") else item for item in data.get("required_epps", [])],
            "allowed_objects": [item.value if hasattr(item, "value") else item for item in data.get("allowed_objects", [])],
            "updated_at": datetime.now(UTC),
        }
        await self.collection.update_one({"_id": ObjectId(area_id)}, {"$set": update_data})
        updated = await self.get_by_id(area_id)
        if updated:
            await self.db.cameras.update_many(
                {"area_id": area_id},
                {
                    "$set": {
                        "area_name": updated["name"],
                        "location": updated["name"],
                        "updated_at": datetime.now(UTC),
                    }
                },
            )
        return updated

    async def delete(self, area_id: str) -> bool:
        if not ObjectId.is_valid(area_id):
            return False
        result = await self.collection.delete_one({"_id": ObjectId(area_id)})
        if result.deleted_count == 1:
            await self.db.cameras.update_many(
                {"area_id": area_id},
                {
                    "$set": {"area_id": None, "area_name": None, "updated_at": datetime.now(UTC)},
                },
            )
        return result.deleted_count == 1
