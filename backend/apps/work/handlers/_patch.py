"""Applying a partially provided payload to an entity.

Pydantic knows which fields the client actually sent (``model_fields_set``).
Writing each of them out by hand is the same three lines repeated per field and
per use case, so this is the one place that turns "the payload carried it" into
an assignment — the loop Django REST Framework's generated
``ModelSerializer.update`` performs. Payload field names match entity field
names; where a value is not a straight copy, ``resolve`` says how to translate
it.
"""


from typing import Callable

from pydantic import BaseModel


def apply_provided(
    payload: BaseModel, target: object, *, resolve: dict[str, Callable[[object], object]] | None = None
) -> None:
    """Set the fields the payload carried on ``target``.

    ``resolve`` maps a payload field to a callable that turns its value into
    what the entity stores, for the fields that do not map one to one — an id
    that has to be looked up, a name that has to be validated.

    An explicit ``null`` is skipped: nothing stored here is nullable, so the
    only meaning ``null`` could carry is "leave this field alone".
    """
    resolve = resolve or {}
    for field in payload.model_fields_set:
        value = getattr(payload, field)
        if value is None:
            continue
        converter = resolve.get(field)
        setattr(target, field, converter(value) if converter else value)
