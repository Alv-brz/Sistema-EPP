from pydantic import BaseModel, Field


DEFAULT_ENABLED_CLASSES = ["helmet", "vest", "mask"]
DEFAULT_ENABLED_OBJECTS = ["persona", "vehiculo", "maquinaria", "cono_seguridad"]
MODEL_OPTIONS = ["best.pt", "best2.pt", "best3.pt"]
LEGACY_MODEL_FALLBACKS: dict[str, str] = {
    "belst.pt": "best.pt",
    "bes33t.pt": "best.pt",
}
MODEL_RECOMMENDED_THRESHOLDS: dict[str, float] = {
    "best.pt": 0.50,
    "best2.pt": 0.50,
    "best3.pt": 0.05,
}

MODEL_CLASSES: dict[str, list[str]] = {
    "best.pt": ["Hardhat", "Mask", "NO-Hardhat", "NO-Mask", "NO-Safety Vest", "Person", "Safety Cone", "Safety Vest", "machinery", "vehicle"],
    "best2.pt": ["Hardhat", "Mask", "NO-Hardhat", "NO-Mask", "NO-Safety Vest", "Person", "Safety Cone", "Safety Vest", "machinery", "vehicle"],
    "best3.pt": ["helmet", "gloves", "vest", "boots", "goggles", "none", "Person", "no_helmet", "no_goggle", "no_gloves", "no_boots"],
}

MODEL_EPP_OPTIONS: dict[str, list[str]] = {
    "best.pt": ["helmet", "vest", "mask"],
    "best2.pt": ["helmet", "vest", "mask"],
    "best3.pt": ["helmet", "vest", "gloves", "boots", "goggles"],
}

MODEL_OBJECT_OPTIONS: dict[str, list[str]] = {
    "best.pt": ["persona", "vehiculo", "maquinaria", "cono_seguridad"],
    "best2.pt": ["persona", "vehiculo", "maquinaria", "cono_seguridad"],
    "best3.pt": ["persona"],
}


def normalize_model_name(model_name: str) -> str:
    return model_name if model_name in MODEL_OPTIONS else LEGACY_MODEL_FALLBACKS.get(model_name, "best.pt")


def normalize_enabled_classes(model_name: str, enabled_classes: list[str]) -> list[str]:
    allowed = MODEL_EPP_OPTIONS.get(normalize_model_name(model_name), DEFAULT_ENABLED_CLASSES)
    normalized = [item for item in enabled_classes if item in allowed]
    return normalized or list(allowed)


def normalize_enabled_objects(model_name: str, enabled_objects: list[str] | None) -> list[str]:
    allowed = MODEL_OBJECT_OPTIONS.get(normalize_model_name(model_name), [])
    if enabled_objects is None:
        return list(allowed)
    normalized = [item for item in enabled_objects if item in allowed]
    return normalized


class YoloSettingsPublic(BaseModel):
    active_model: str = "best.pt"
    confidence_threshold: float = Field(default=0.5, ge=0.01, le=1.0)
    enabled_classes: list[str] = Field(default_factory=lambda: list(DEFAULT_ENABLED_CLASSES))
    enabled_objects: list[str] = Field(default_factory=lambda: list(DEFAULT_ENABLED_OBJECTS))
    detection_enabled: bool = True
    available_models: list[str] = Field(default_factory=lambda: list(MODEL_OPTIONS))
    available_classes: list[str] = Field(default_factory=list)
    recommended_threshold: float = 0.5


class YoloSettingsUpdate(BaseModel):
    active_model: str
    confidence_threshold: float = Field(ge=0.01, le=1.0)
    enabled_classes: list[str]
    enabled_objects: list[str] = Field(default_factory=lambda: list(DEFAULT_ENABLED_OBJECTS))
    detection_enabled: bool


class GeneralSettingsPublic(BaseModel):
    alarm_sound_enabled: bool = True
    alarm_volume: int = Field(default=80, ge=0, le=100)
    email_alerts: bool = False
    alert_recipients: str = ""
    auto_archive: bool = True
    retention_days: int = Field(default=365, ge=1, le=3650)


class GeneralSettingsUpdate(GeneralSettingsPublic):
    pass
