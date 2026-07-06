from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field


class RequiredEPP(StrEnum):
    casco = "casco"
    chaleco = "chaleco"
    mascarilla = "mascarilla"
    guantes = "guantes"
    botas = "botas"
    lentes = "lentes"


class AllowedObject(StrEnum):
    persona = "persona"
    vehiculo = "vehiculo"
    maquinaria = "maquinaria"
    cono_seguridad = "cono_seguridad"


class AreaInDB(BaseModel):
    id: str = Field(alias="_id")
    name: str
    description: str
    required_epps: list[RequiredEPP]
    allowed_objects: list[AllowedObject] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
