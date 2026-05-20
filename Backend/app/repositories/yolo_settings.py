from datetime import UTC, datetime

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.schemas.yolo_settings import DEFAULT_ENABLED_CLASSES, MODEL_CLASSES, MODEL_OPTIONS, MODEL_RECOMMENDED_THRESHOLDS


SETTINGS_KEY = "yolo"


def default_yolo_settings() -> dict:
    return {
        "key": SETTINGS_KEY,
        "active_model": "best.pt",
        "confidence_threshold": 0.5,
        "enabled_classes": list(DEFAULT_ENABLED_CLASSES),
        "detection_enabled": True,
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC),
    }


def serialize_settings(document: dict | None) -> dict:
    if not document:
        document = default_yolo_settings()
    document = dict(document)
    document.pop("_id", None)
    document.pop("key", None)
    active_model = document.get("active_model", "best.pt")
    document["available_models"] = list(MODEL_OPTIONS)
    document["available_classes"] = MODEL_CLASSES.get(active_model, [])
    document["recommended_threshold"] = MODEL_RECOMMENDED_THRESHOLDS.get(active_model, 0.5)
    return document


class YoloSettingsRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.collection = db.settings

    async def get(self) -> dict:
        document = await self.collection.find_one({"key": SETTINGS_KEY})
        if not document:
            await self.collection.update_one({"key": SETTINGS_KEY}, {"$setOnInsert": default_yolo_settings()}, upsert=True)
            document = await self.collection.find_one({"key": SETTINGS_KEY})
        return serialize_settings(document)

    async def update(self, data: dict) -> dict:
        active_model = data["active_model"]
        if active_model not in MODEL_OPTIONS:
            raise ValueError("Unsupported YOLO model")
        now = datetime.now(UTC)
        document = {
            "key": SETTINGS_KEY,
            "active_model": active_model,
            "confidence_threshold": max(0.01, min(float(data["confidence_threshold"]), 1.0)),
            "enabled_classes": data["enabled_classes"],
            "detection_enabled": data["detection_enabled"],
            "updated_at": now,
        }
        await self.collection.update_one(
            {"key": SETTINGS_KEY},
            {"$set": document, "$setOnInsert": {"created_at": now}},
            upsert=True,
        )
        return await self.get()
