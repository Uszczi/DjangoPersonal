"""The rule tying an Attempt's progress to its BibliographyItem's length.

Both sides can change it: moving the progress on, and editing the item's length,
so the check lives here for both use cases.
"""

from personal.core.shared.errors import DomainError


def check_progress_within_length(progress: int | None, length: int | None) -> None:
    """Progress (page or minute) may reach the length but not pass it; no length, no bound."""
    if progress is not None and length is not None and progress > length:
        raise DomainError(f'Progress cannot be greater than the length ({length}).')
