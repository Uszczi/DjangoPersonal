"""The colour type shared by every feature whose objects can be given a colour."""

from typing import Annotated

from pydantic import Field

#: A ``#RRGGBB`` hex colour. The API accepts any; the clients offer a palette.
HexColor = Annotated[str, Field(pattern=r'^#[0-9a-fA-F]{6}$')]
