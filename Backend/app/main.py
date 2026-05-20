from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.db.mongodb import close_mongo_connection, connect_to_mongo, get_database
from app.repositories.cameras import CameraRepository
from app.repositories.users import UserRepository
from app.repositories.yolo_settings import YoloSettingsRepository
from app.services.video_stream_service import video_stream_manager


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    settings.upload_path.mkdir(parents=True, exist_ok=True)
    settings.annotated_path.mkdir(parents=True, exist_ok=True)
    await connect_to_mongo(settings)
    await UserRepository(get_database()).ensure_default_admin(
        email=settings.default_admin_email,
        name=settings.default_admin_name,
        password=settings.default_admin_password,
    )
    await CameraRepository(get_database()).ensure_defaults()
    await YoloSettingsRepository(get_database()).get()
    yield
    video_stream_manager.stop_all()
    await close_mongo_connection()


settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_v1_prefix)
