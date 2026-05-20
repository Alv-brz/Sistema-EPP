from app.repositories.areas import AreaRepository


class AreaService:
    def __init__(self, areas: AreaRepository):
        self.areas = areas

    async def list(self) -> list[dict]:
        return await self.areas.list()

    async def get(self, area_id: str) -> dict | None:
        return await self.areas.get_by_id(area_id)

    async def create(self, data: dict) -> dict:
        return await self.areas.create(data)

    async def update(self, area_id: str, data: dict) -> dict | None:
        return await self.areas.update(area_id, data)

    async def delete(self, area_id: str) -> bool:
        return await self.areas.delete(area_id)
