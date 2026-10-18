"""Partial-update application shared by the expenses use cases.

Mirrors ``apps.work.handlers._patch``: an explicit ``null`` is skipped, so a
sent ``None`` means "leave this field alone" rather than clearing it. Keeping
the two copies identical avoids the drift where a ``PATCH`` carrying
``{"name": null}`` reached ``Wallet.save()`` and blew up normalising a
``None`` name.
"""

from typing import Callable

from pydantic import BaseModel


def apply_provided(
    payload: BaseModel,
    target: object,
    *,
    resolve: dict[str, Callable[[object], object]] | None = None,
) -> None:
    """Set the fields the payload carried on ``target``.

    Only fields present in ``payload.model_fields_set`` are applied, so an
    absent field leaves the current value alone — as does an explicit
    ``None``. A registered ``resolve`` callable turns the raw value into the
    stored one for fields that do not map one-to-one.
    """
    resolve = resolve or {}
    for field_name in payload.model_fields_set:
        value = getattr(payload, field_name)
        if value is None:
            continue
        converter = resolve.get(field_name)
        setattr(target, field_name, converter(value) if converter else value)
