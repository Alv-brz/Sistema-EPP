from datetime import UTC, datetime
import re
from typing import Any

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase


def serialize_detection(document: dict | None) -> dict | None:
    if not document:
        return None
    document = dict(document)
    document["id"] = str(document.pop("_id"))
    for key in ("created_at", "timestamp"):
        value = document.get(key)
        if isinstance(value, datetime) and value.tzinfo is None:
            document[key] = value.replace(tzinfo=UTC)
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

    async def list(
        self,
        limit: int,
        offset: int,
        camera_id: str | None = None,
        search: str | None = None,
        area: str | None = None,
        epp: str | None = None,
        detected_object: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        violations_only: bool = False,
    ) -> tuple[list[dict], int]:
        query: dict[str, Any] = {}
        if camera_id:
            query["$or"] = [
                {"camera_id": camera_id},
                {"camera_code": camera_id},
                {"camera_object_id": camera_id},
            ]
        if search:
            pattern = re.compile(re.escape(search), re.IGNORECASE)
            search_filters: list[dict[str, Any]] = [
                {"camera_id": pattern},
                {"camera_code": pattern},
                {"camera_object_id": pattern},
                {"area_name": pattern},
                {"location": pattern},
                {"missing_epps": pattern},
                {"detected_classes": pattern},
                {"detected_objects": pattern},
            ]
            if ObjectId.is_valid(search):
                search_filters.append({"_id": ObjectId(search)})
            if "$or" in query:
                query = {"$and": [{"$or": query["$or"]}, {"$or": search_filters}]}
            else:
                query["$or"] = search_filters
        if area:
            area_pattern = re.compile(re.escape(area), re.IGNORECASE)
            query.setdefault("$and", []).append({"$or": [{"area_name": area_pattern}, {"location": area_pattern}]})
        if epp:
            query["missing_epps"] = epp
        if detected_object:
            query.setdefault("$and", []).append({"$or": [{"detected_objects": detected_object}, {"detected_classes": detected_object}]})
        if violations_only:
            query["missing_epps.0"] = {"$exists": True}
        if date_from or date_to:
            created_at: dict[str, datetime] = {}
            if date_from:
                created_at["$gte"] = date_from
            if date_to:
                created_at["$lte"] = date_to
            query["created_at"] = created_at
        total = await self.collection.count_documents(query)
        cursor = self.collection.find(query).sort("created_at", -1).skip(offset).limit(limit)
        return [serialize_detection(document) async for document in cursor if document], total
