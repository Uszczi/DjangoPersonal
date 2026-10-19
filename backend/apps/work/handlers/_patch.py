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

    Only fields absent from the payload are skipped. An explicit ``null`` is
    applied verbatim, so it clears nullable fields; contracts reject ``null``
    for fields whose storage cannot hold it. A ``null`` bypasses ``resolve``:
    clearing needs no translation.
    """
    resolve = resolve or {}
    for field in payload.model_fields_set:
        value = getattr(payload, field)
        converter = resolve.get(field)
        setattr(target, field, converter(value) if converter and value is not None else value)
