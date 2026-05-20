from datetime import UTC, datetime

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase


def serialize_camera(document: dict | None) -> dict | None:
    if not document:
        return None
    document = dict(document)
    document["id"] = str(document.pop("_id"))
    return document


class CameraRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.cameras

    async def _area_fields(self, area_id: str | None) -> dict:
        if not area_id:
            return {}
        if not ObjectId.is_valid(area_id):
            raise ValueError("Invalid area_id")
        area = await self.db.areas.find_one({"_id": ObjectId(area_id)})
        if not area:
            raise ValueError("Area not found")
        return {
            "area_id": str(area["_id"]),
            "area_name": area["name"],
            "location": area["name"],
        }

    async def list(self) -> list[dict]:
        cursor = self.collection.find().sort("code", 1)
        return [serialize_camera(document) async for document in cursor if document]

    async def get_by_id(self, camera_id: str) -> dict | None:
        if not ObjectId.is_valid(camera_id):
            return None
        return serialize_camera(await self.collection.find_one({"_id": ObjectId(camera_id)}))

    async def create(self, data: dict) -> dict:
        now = datetime.now(UTC)
        next_number = await self.collection.count_documents({}) + 1
        area_fields = await self._area_fields(data.get("area_id"))
        document = {
            **data,
            **area_fields,
            "location": area_fields.get("location", data.get("location", "")),
            "source_type": data.get("source_type", "webcam"),
            "source_url": data.get("source_url") or "0",
            "code": f"CAM-{next_number:02d}",
            "created_at": now,
            "updated_at": now,
        }
        result = await self.collection.insert_one(document)
        created = await self.collection.find_one({"_id": result.inserted_id})
        serialized = serialize_camera(created)
        if serialized is None:
            raise RuntimeError("Created camera could not be loaded")
        return serialized

    async def update(self, camera_id: str, data: dict) -> dict | None:
        if not ObjectId.is_valid(camera_id):
            return None
        update_data = {key: value for key, value in data.items() if value is not None}
        if "area_id" in update_data:
            area_fields = await self._area_fields(update_data["area_id"])
            update_data.update(area_fields)
        for key, value in list(update_data.items()):
            if hasattr(value, "value"):
                update_data[key] = value.value
        update_data["updated_at"] = datetime.now(UTC)
        await self.collection.update_one({"_id": ObjectId(camera_id)}, {"$set": update_data})
        return await self.get_by_id(camera_id)

    async def delete(self, camera_id: str) -> bool:
        if not ObjectId.is_valid(camera_id):
            return False
        result = await self.collection.delete_one({"_id": ObjectId(camera_id)})
        return result.deleted_count == 1

    async def ensure_defaults(self) -> None:
        if await self.collection.count_documents({}) > 0:
            await self.ensure_video_fields()
            return
        defaults = [
            ("Acceso Principal Obra", "Entrada Principal - Control de Personal", "192.168.1.101", "online"),
            ("Zona de Excavacion", "Area de Excavacion - Nivel 1", "192.168.1.102", "online"),
            ("Andamios / Altura", "Estructura - Trabajo en Altura", "192.168.1.103", "online"),
            ("Zona de Carga", "Carga y Descarga de Materiales", "192.168.1.104", "online"),
            ("Almacen General", "Almacen - Control de Inventario", "192.168.1.105", "offline"),
            ("Zona de Soldadura", "Area de Corte y Soldadura", "192.168.1.106", "online"),
        ]
        for name, location, ip, status in defaults:
            await self.create(
                {
                    "name": name,
                    "location": location,
                    "ip": ip,
                    "status": status,
                    "source_type": "webcam" if ip.endswith(".101") else "rtsp",
                    "source_url": "0" if ip.endswith(".101") else f"rtsp://{ip}/stream1",
                    "resolution": "1920x1080",
                    "fps": 30,
                    "area_id": None,
                    "area_name": None,
                }
            )

    async def ensure_video_fields(self) -> None:
        cursor = self.collection.find(
            {
                "$or": [
                    {"source_type": {"$exists": False}},
                    {"source_url": {"$exists": False}},
                ]
            }
        )
        async for camera in cursor:
            ip = camera.get("ip", "")
            is_first_camera = camera.get("code") == "CAM-01"
            source_type = "webcam" if is_first_camera else "rtsp"
            source_url = "0" if is_first_camera else f"rtsp://{ip}/stream1"
            await self.collection.update_one(
                {"_id": camera["_id"]},
                {
                    "$set": {
                        "source_type": camera.get("source_type", source_type),
                        "source_url": camera.get("source_url", source_url),
                        "area_id": camera.get("area_id"),
                        "area_name": camera.get("area_name"),
                        "updated_at": datetime.now(UTC),
                    }
                },
            )
