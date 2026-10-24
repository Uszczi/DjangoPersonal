"""Common Pydantic base for all wire contracts.

``from_attributes=True`` lets a contract be built directly from an ORM
instance (``Model.model_validate(orm_object)``) without each model having to
repeat the setting.
"""

from pydantic import BaseModel as _PydanticBaseModel
from pydantic import ConfigDict


class BaseModel(_PydanticBaseModel):
    model_config = ConfigDict(from_attributes=True)
