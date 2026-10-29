"""How an attachment's stored type and name are decided."""

import pytest

from personal.core.work.attachments import clean_file_name, sniff_image_type, stored_content_type


@pytest.mark.parametrize(
    ('data', 'expected'),
    [
        (b'\xff\xd8\xff\xe0rest', 'image/jpeg'),
        (b'\x89PNG\r\n\x1a\nrest', 'image/png'),
        (b'GIF89a...', 'image/gif'),
        (b'RIFF\x00\x00\x00\x00WEBPVP8 ', 'image/webp'),
        (b'<svg xmlns="http://www.w3.org/2000/svg"/>', None),
        (b'%PDF-1.7', None),
    ],
)
def test_sniff_image_type(data: bytes, expected: str | None) -> None:
    assert sniff_image_type(data) == expected


def test_declared_type_is_kept_for_other_files() -> None:
    assert stored_content_type(b'%PDF-1.7', 'Application/PDF; charset=x') == 'application/pdf'


@pytest.mark.parametrize('declared', [None, '', 'nonsense', 'image/png', 'image/jpeg'])
def test_unknown_or_unproven_type_falls_back(declared: str | None) -> None:
    assert stored_content_type(b'plain bytes', declared) == 'application/octet-stream'


@pytest.mark.parametrize(
    ('name', 'expected'),
    [
        ('photo.jpg', 'photo.jpg'),
        ('../../etc/passwd', 'passwd'),
        ('C:\\Users\\me\\scan.pdf', 'scan.pdf'),
        ('  bad\x00name.txt ', 'badname.txt'),
        ('', 'file'),
        (None, 'file'),
        ('a' * 300 + '.jpeg', 'a' * 250 + '.jpeg'),
    ],
)
def test_clean_file_name(name: str | None, expected: str) -> None:
    assert clean_file_name(name) == expected
