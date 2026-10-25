"""Matching for the Notatnik search: names and Notatka lines, grep-style.

Matching ignores case and Polish diacritics, so "zolw" finds "Żółw", and a
query of several words matches text that contains every one of them.
"""

import re
import unicodedata


def search_key(text: str) -> str:
    """Lowercase and without diacritics (``ł`` has none to strip, so it is mapped)."""
    decomposed = unicodedata.normalize('NFD', text)
    stripped = ''.join(c for c in decomposed if not unicodedata.combining(c))
    return stripped.replace('ł', 'l').replace('Ł', 'L').lower()


def query_words(query: str) -> list[str]:
    return search_key(query).split()


def matches(text: str, words: list[str]) -> bool:
    """Whether ``text`` contains every word; ``words`` come from ``query_words``."""
    key = search_key(text)
    return all(word in key for word in words)


def matching_lines(text: str, words: list[str]) -> list[tuple[int, str]]:
    """The lines of ``text`` that match ``words``, numbered from 1, trimmed."""
    if not words:
        return []
    return [
        (number, line.strip())
        for number, line in enumerate(re.split(r'\r?\n', text), start=1)
        if matches(line, words)
    ]
