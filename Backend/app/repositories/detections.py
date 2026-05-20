from datetime import UTC, datetime
from typing import Any

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase


def serialize_detection(document: dict | None) -> dict | None:
    if not document:
        return None
    document = dict(document)
    document["id"] = str(document.pop("_id"))
    return document


class DetectionRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.collection = db.detections

    async def create(self, data: dict[str, Any]) -> dict:
        document = dict(data)
        document["created_at"] = datetime.now(UTC)
        result = await self.collection.insert_one(document)
        created = await self.collection.find_one({"_id": result.inserted_id})
        serialized = serialize_detection(created)
        if serialized is None:
            raise RuntimeError("Created detection could not be loaded")
        return serialized

    async def get_by_id(self, detection_id: str) -> dict | None:
        if not ObjectId.is_valid(detection_id):
            return None
        return serialize_detection(await self.collection.find_one({"_id": ObjectId(detection_id)}))

    async def list(self, limit: int, offset: int, camera_id: str | None = None) -> tuple[list[dict], int]:
        query: dict[str, Any] = {}
        if camera_id:
            query["camera_id"] = camera_id
        total = await self.collection.count_documents(query)
        cursor = self.collection.find(query).sort("created_at", -1).skip(offset).limit(limit)
        return [serialize_detection(document) async for document in cursor if document], total
