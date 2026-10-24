"""The icon name shared by the category and wallet contracts."""

from typing import Annotated

from pydantic import Field

#: A lucide icon name: lower-case words joined by hyphens. The API checks the
#: shape, not membership: the icon set grows with every lucide release, and the
#: frontend falls back to a default icon for a name it cannot render.
IconName = Annotated[str, Field(pattern=r'^[a-z0-9]+(-[a-z0-9]+)*$', max_length=64)]
