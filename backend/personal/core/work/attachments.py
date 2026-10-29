"""What a comment's attachment may be, and how its stored type is decided.

Files are kept exactly as uploaded. Only the content type is the server's own
call: a picture is recognised from its first bytes, never from what the client
claims, because pictures are the only files clients show inline.
"""

import re
from dataclasses import dataclass

from personal.infra.models import INLINE_IMAGE_TYPES

#: The largest file one upload may carry (the reverse proxy allows a bit more).
MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024
MAX_FILE_NAME_LENGTH = 255
FALLBACK_CONTENT_TYPE = 'application/octet-stream'
FALLBACK_FILE_NAME = 'file'

_MIME_TYPE = re.compile(r"^[a-z0-9][a-z0-9!#$&^_.+-]*/[a-z0-9][a-z0-9!#$&^_.+-]*$")
_CONTROL_CHARACTERS = re.compile(r'[\x00-\x1f\x7f]')


@dataclass(frozen=True)
class NewAttachment:
    """An uploaded file as the transport received it."""

    file_name: str
    content_type: str | None
    data: bytes


def sniff_image_type(data: bytes) -> str | None:
    """The picture type the bytes start with, if they are one clients can show."""
    if data.startswith(b'\xff\xd8\xff'):
        return 'image/jpeg'
    if data.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'image/png'
    if data.startswith((b'GIF87a', b'GIF89a')):
        return 'image/gif'
    if data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        return 'image/webp'
    return None


def stored_content_type(data: bytes, declared: str | None) -> str:
    """The type to store: the sniffed picture type, else the declared one.

    A declared picture type the bytes do not bear out is dropped, so a file is
    never shown inline unless it really is a picture.
    """
    sniffed = sniff_image_type(data)
    if sniffed is not None:
        return sniffed
    cleaned = (declared or '').split(';')[0].strip().lower()
    if not _MIME_TYPE.match(cleaned) or len(cleaned) > 127 or cleaned in INLINE_IMAGE_TYPES:
        return FALLBACK_CONTENT_TYPE
    return cleaned


def clean_file_name(name: str | None) -> str:
    """The file's own name, without any directory part or control characters."""
    base = re.split(r'[\\/]', name or '')[-1]
    base = _CONTROL_CHARACTERS.sub('', base).strip()
    if len(base) > MAX_FILE_NAME_LENGTH:
        stem, dot, extension = base.rpartition('.')
        if dot and 0 < len(extension) <= 16:
            base = stem[: MAX_FILE_NAME_LENGTH - len(extension) - 1] + '.' + extension
        else:
            base = base[:MAX_FILE_NAME_LENGTH]
    return base or FALLBACK_FILE_NAME
