from functools import lru_cache
from pathlib import Path

from pydantic import Field, ValidationInfo, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Sistema EPP Backend"
    environment: str = "development"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"

    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "sistema_epp"

    jwt_secret_key: str = Field(default="change-this-secret-before-production-please", min_length=32)
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 480

    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    detector_model_path: str = "../Detector/best.pt"
    detector_confidence: float = 0.5
    detector_enabled: bool = True
    detector_frame_skip: int = 5
    detector_save_interval_seconds: int = 10

    upload_dir: str = "storage/uploads"
    annotated_dir: str = "storage/annotated"

    default_admin_email: str = "admin@empresa.com"
    default_admin_password: str = "password123"
    default_admin_name: str = "Administrador"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("jwt_secret_key")
    @classmethod
    def validate_jwt_secret_key(cls, value: str, info: ValidationInfo) -> str:
        environment = str(info.data.get("environment", "development")).lower()
        local_environments = {"development", "dev", "local", "test", "testing"}
        if environment not in local_environments and value.startswith("change-this-secret"):
            raise ValueError("JWT_SECRET_KEY must be changed outside local development")
        return value

    @field_validator("default_admin_password")
    @classmethod
    def validate_default_admin_password(cls, value: str, info: ValidationInfo) -> str:
        environment = str(info.data.get("environment", "development")).lower()
        local_environments = {"development", "dev", "local", "test", "testing"}
        if environment not in local_environments and value in {"password123", "admin", "admin123"}:
            raise ValueError("DEFAULT_ADMIN_PASSWORD must be changed outside local development")
        return value

    @property
    def upload_path(self) -> Path:
        return Path(self.upload_dir)

    @property
    def annotated_path(self) -> Path:
        return Path(self.annotated_dir)


@lru_cache
def get_settings() -> Settings:
    return Settings()
