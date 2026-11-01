"""Framework-free Prometheus metrics, recorded by the middleware in ``ops``.

The names carry an ``app_`` prefix; the Grafana dashboard
(``deployment/observability/dashboards/app.json``) queries them by that name.

Multiple workers: when ``PROMETHEUS_MULTIPROC_DIR`` is set, prometheus-client
aggregates counters from every worker process, so the app can run with as many
uvicorn workers as needed without losing or duplicating metrics.
"""

import os

from prometheus_client import (
    CONTENT_TYPE_LATEST,
    CollectorRegistry,
    Counter,
    Gauge,
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
    'app_http_requests_total',
    'Total HTTP requests handled by the app.',
    ['method', 'route', 'status'],
)

REQUEST_LATENCY = Histogram(
    'app_http_request_duration_seconds',
    'HTTP request latency in seconds.',
    ['method', 'route'],
)

#: Always 1; the labels carry the information. ``max`` keeps one series across
#: workers (they all report the same build).
BUILD_INFO = Gauge(
    'app_build_info',
    'The running build: commit, and the schema revision the code expects vs the database has.',
    ['version', 'code_schema', 'db_schema'],
    multiprocess_mode='max',
)

__all__ = [
    'BUILD_INFO',
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
