from datetime import datetime

from pydantic import BaseModel, Field

from app.models.area import RequiredEPP


class AreaBase(BaseModel):
    name: str = Field(min_length=1)
    description: str = ""
    required_epps: list[RequiredEPP] = Field(default_factory=list)


class AreaCreate(AreaBase):
    pass


class AreaUpdate(AreaBase):
    pass


class AreaPublic(AreaBase):
    id: str
    created_at: datetime
    updated_at: datetime
