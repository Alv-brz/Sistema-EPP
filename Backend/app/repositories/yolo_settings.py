from datetime import UTC, datetime
from pathlib import Path

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import Settings
from app.schemas.yolo_settings import (
    DEFAULT_ENABLED_CLASSES,
    DEFAULT_ENABLED_OBJECTS,
    MODEL_CLASSES,
    MODEL_OPTIONS,
    MODEL_RECOMMENDED_THRESHOLDS,
    normalize_enabled_classes,
    normalize_enabled_objects,
    normalize_model_name,
)


SETTINGS_KEY = "yolo"
GENERAL_SETTINGS_KEY = "general"


def default_yolo_settings() -> dict:
    return {
        "key": SETTINGS_KEY,
        "active_model": "best.pt",
        "confidence_threshold": 0.5,
        "enabled_classes": list(DEFAULT_ENABLED_CLASSES),
        "enabled_objects": list(DEFAULT_ENABLED_OBJECTS),
        "detection_enabled": True,
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC),
    }


def resolve_model_path(settings: Settings, model_name: str) -> Path:
    configured_path = Path(settings.detector_model_path)
    if not configured_path.is_absolute():
        configured_path = (Path.cwd() / configured_path).resolve()
    return configured_path.with_name(model_name)


def available_model_options(settings: Settings) -> list[str]:
    return [model_name for model_name in MODEL_OPTIONS if resolve_model_path(settings, model_name).is_file()]


def serialize_settings(document: dict | None, settings: Settings) -> dict:
    if not document:
        document = default_yolo_settings()
    document = dict(document)
    document.pop("_id", None)
    document.pop("key", None)
    available_models = available_model_options(settings)
    active_model = normalize_model_name(document.get("active_model", "best.pt"))
    if active_model not in available_models:
        active_model = "best.pt" if "best.pt" in available_models else (available_models[0] if available_models else "best.pt")
    document["active_model"] = active_model
    document["enabled_classes"] = normalize_enabled_classes(active_model, document.get("enabled_classes", []))
    document["enabled_objects"] = normalize_enabled_objects(active_model, document.get("enabled_objects"))
    document["available_models"] = available_models
    document["available_classes"] = MODEL_CLASSES.get(active_model, [])
    document["recommended_threshold"] = MODEL_RECOMMENDED_THRESHOLDS.get(active_model, 0.5)
    return document


def default_general_settings() -> dict:
    return {
        "key": GENERAL_SETTINGS_KEY,
        "alarm_sound_enabled": True,
        "alarm_volume": 80,
        "email_alerts": False,
        "alert_recipients": "",
        "auto_archive": True,
        "retention_days": 365,
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC),
    }


def serialize_general_settings(document: dict | None) -> dict:
    if not document:
        document = default_general_settings()
    document = dict(document)
    document.pop("_id", None)
    document.pop("key", None)
    return document


class YoloSettingsRepository:
    def __init__(self, db: AsyncIOMotorDatabase, settings: Settings):
        self.collection = db.settings
        self.settings = settings

    async def get(self) -> dict:
        document = await self.collection.find_one({"key": SETTINGS_KEY})
        if not document:
            await self.collection.update_one({"key": SETTINGS_KEY}, {"$setOnInsert": default_yolo_settings()}, upsert=True)
            document = await self.collection.find_one({"key": SETTINGS_KEY})
        return serialize_settings(document, self.settings)

    async def update(self, data: dict) -> dict:
        active_model = data["active_model"]
        if active_model not in MODEL_OPTIONS:
            raise ValueError("Unsupported YOLO model")
        if not resolve_model_path(self.settings, active_model).is_file():
            raise ValueError(f"YOLO model file not found: {active_model}")
        now = datetime.now(UTC)
        document = {
            "key": SETTINGS_KEY,
            "active_model": active_model,
            "confidence_threshold": max(0.01, min(float(data["confidence_threshold"]), 1.0)),
            "enabled_classes": normalize_enabled_classes(active_model, data["enabled_classes"]),
            "enabled_objects": normalize_enabled_objects(active_model, data.get("enabled_objects")),
            "detection_enabled": data["detection_enabled"],
            "updated_at": now,
        }
        await self.collection.update_one(
            {"key": SETTINGS_KEY},
            {"$set": document, "$setOnInsert": {"created_at": now}},
            upsert=True,
        )
        return await self.get()

    async def get_general(self) -> dict:
        document = await self.collection.find_one({"key": GENERAL_SETTINGS_KEY})
        if not document:
            await self.collection.update_one(
                {"key": GENERAL_SETTINGS_KEY},
                {"$setOnInsert": default_general_settings()},
                upsert=True,
            )
            document = await self.collection.find_one({"key": GENERAL_SETTINGS_KEY})
        return serialize_general_settings(document)

    async def update_general(self, data: dict) -> dict:
        now = datetime.now(UTC)
        document = {
            "key": GENERAL_SETTINGS_KEY,
            "alarm_sound_enabled": bool(data["alarm_sound_enabled"]),
            "alarm_volume": max(0, min(int(data["alarm_volume"]), 100)),
            "email_alerts": bool(data["email_alerts"]),
            "alert_recipients": data.get("alert_recipients", ""),
            "auto_archive": bool(data["auto_archive"]),
            "retention_days": max(1, min(int(data["retention_days"]), 3650)),
            "updated_at": now,
        }
        await self.collection.update_one(
            {"key": GENERAL_SETTINGS_KEY},
            {"$set": document, "$setOnInsert": {"created_at": now}},
            upsert=True,
        )
        return await self.get_general()
