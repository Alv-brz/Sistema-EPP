from pydantic import BaseModel, Field


DEFAULT_ENABLED_CLASSES = ["helmet", "vest", "person"]
MODEL_OPTIONS = ["best.pt", "belst.pt", "bes33t.pt"]
MODEL_RECOMMENDED_THRESHOLDS: dict[str, float] = {
    "best.pt": 0.50,
    "belst.pt": 0.05,
    "bes33t.pt": 0.20,
}

MODEL_CLASSES: dict[str, list[str]] = {
    "best.pt": ["Hardhat", "Safety Vest", "Person", "NO-Hardhat", "NO-Safety Vest", "NO-Mask"],
    "belst.pt": ["helmet", "gloves", "vest", "boots", "goggles", "no_helmet", "no_gloves", "no_boots", "no_goggle"],
    "bes33t.pt": ["Hardhat", "Safety Vest", "Person", "NO-Hardhat", "NO-Safety Vest", "NO-Mask"],
}


class YoloSettingsPublic(BaseModel):
    active_model: str = "best.pt"
    confidence_threshold: float = Field(default=0.5, ge=0.01, le=1.0)
    enabled_classes: list[str] = Field(default_factory=lambda: list(DEFAULT_ENABLED_CLASSES))
    detection_enabled: bool = True
    available_models: list[str] = Field(default_factory=lambda: list(MODEL_OPTIONS))
    available_classes: list[str] = Field(default_factory=list)
    recommended_threshold: float = 0.5


class YoloSettingsUpdate(BaseModel):
    active_model: str
    confidence_threshold: float = Field(ge=0.01, le=1.0)
    enabled_classes: list[str]
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
