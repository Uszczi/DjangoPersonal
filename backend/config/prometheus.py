"""Framework-free Prometheus metrics shared by the Django and FastAPI apps.

Both apps record into the same collectors (each framework has its own
middleware: ``config.metrics`` for Django, ``config.ops`` for FastAPI). The
metric names keep their ``django_`` prefix after the FastAPI cutover so the
Grafana dashboards and their history carry over unchanged.

Multiple workers: when ``PROMETHEUS_MULTIPROC_DIR`` is set, prometheus-client
aggregates counters from every worker process, so the app can run with as many
uvicorn workers as needed without losing or duplicating metrics.
"""

import os

from prometheus_client import (
    CONTENT_TYPE_LATEST,
    CollectorRegistry,
    Counter,
    Histogram,
    generate_latest,
    multiprocess,
)

PROMETHEUS_MULTIPROC_DIR = os.environ.get('PROMETHEUS_MULTIPROC_DIR')
MULTIPROCESS_MODE = bool(PROMETHEUS_MULTIPROC_DIR)

# Probes and scraping are infrastructure, not user traffic - keep them out of
# the request counters so dashboards stay readable.
UNMETERED_PATHS = ('/metrics', '/health', '/health/ready')

REQUEST_COUNT = Counter(
    'django_http_requests_total',
    'Total HTTP requests handled by the Django app.',
    ['method', 'route', 'status'],
)

REQUEST_LATENCY = Histogram(
    'django_http_request_duration_seconds',
    'HTTP request latency in seconds.',
    ['method', 'route'],
)

__all__ = [
    'CONTENT_TYPE_LATEST',
    'MULTIPROCESS_MODE',
    'REQUEST_COUNT',
    'REQUEST_LATENCY',
    'UNMETERED_PATHS',
    'render_metrics',
]


def render_metrics() -> bytes:
    if not MULTIPROCESS_MODE:
        return generate_latest()

    registry = CollectorRegistry()
    multiprocess.MultiProcessCollector(registry)  # type: ignore[no-untyped-call]
    return generate_latest(registry)
