from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field


class RequiredEPP(StrEnum):
    casco = "casco"
    chaleco = "chaleco"
    guantes = "guantes"
    botas = "botas"
    lentes = "lentes"


class AreaInDB(BaseModel):
    id: str = Field(alias="_id")
    name: str
    description: str
    required_epps: list[RequiredEPP]
    created_at: datetime
    updated_at: datetime
