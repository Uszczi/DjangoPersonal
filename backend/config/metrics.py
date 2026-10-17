"""Prometheus metrics for the Django app.

Exposes request rate / latency / status codes on ``/metrics`` (scraped by
Prometheus over the compose network, not through the public reverse proxy).

Multiple workers: when ``PROMETHEUS_MULTIPROC_DIR`` is set, prometheus-client
aggregates counters from every worker process, so the app can run with as many
uvicorn workers as needed without losing or duplicating metrics.
"""

import os
import time
from collections.abc import Callable

from django.http import HttpRequest, HttpResponse
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


def _route_label(request: HttpRequest) -> str:
    """Prefer the resolved route pattern so labels stay low-cardinality."""
    match = getattr(request, 'resolver_match', None)
    route = getattr(match, 'route', None)
    if isinstance(route, str) and route:
        return '/' + route.lstrip('/')
    return request.path


class MetricsMiddleware:
    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        if request.path in UNMETERED_PATHS:
            return self.get_response(request)

        started = time.perf_counter()
        response = self.get_response(request)
        duration = time.perf_counter() - started

        route = _route_label(request)
        REQUEST_COUNT.labels(request.method, route, response.status_code).inc()
        REQUEST_LATENCY.labels(request.method, route).observe(duration)
        return response


def _render_metrics() -> bytes:
    if not MULTIPROCESS_MODE:
        return generate_latest()

    registry = CollectorRegistry()
    multiprocess.MultiProcessCollector(registry)  # type: ignore[no-untyped-call]
    return generate_latest(registry)


def metrics_view(request: HttpRequest) -> HttpResponse:
    return HttpResponse(_render_metrics(), content_type=CONTENT_TYPE_LATEST)
