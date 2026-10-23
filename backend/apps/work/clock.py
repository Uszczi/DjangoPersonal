from datetime import UTC, datetime


def now() -> datetime:
    """Current server time, timezone-aware in UTC.

    The single seam tests use to control the clock; every timestamp in the
    handler layer flows through here rather than calling ``datetime.now``
    directly.
    """
    return datetime.now(UTC)
