from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import Settings


class Mongo:
    client: AsyncIOMotorClient | None = None
    db: AsyncIOMotorDatabase | None = None


mongo = Mongo()


async def connect_to_mongo(settings: Settings) -> None:
    mongo.client = AsyncIOMotorClient(settings.mongodb_uri)
    mongo.db = mongo.client[settings.mongodb_db]
    await mongo.db.command("ping")
    await create_indexes(mongo.db)


async def close_mongo_connection() -> None:
    if mongo.client:
        mongo.client.close()
    mongo.client = None
    mongo.db = None


def get_database() -> AsyncIOMotorDatabase:
    if mongo.db is None:
        raise RuntimeError("MongoDB is not connected")
    return mongo.db


async def create_indexes(db: AsyncIOMotorDatabase) -> None:
    await db.users.create_index("email", unique=True)
    await db.settings.create_index("key", unique=True)
    await db.areas.create_index("name", unique=True)
    await db.cameras.create_index("code", unique=True)
    await db.cameras.create_index("area_id")
    await db.detections.create_index([("created_at", -1)])
    await db.detections.create_index("camera_id")
    await db.detections.create_index("area_id")
    await db.detections.create_index("severity")
