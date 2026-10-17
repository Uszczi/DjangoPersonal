from django.utils import timezone


def now():
    """Current server time.

    The single seam tests use to control the clock; every timestamp in the
    handler layer flows through here rather than calling ``timezone.now``
    directly.
    """
    return timezone.now()
