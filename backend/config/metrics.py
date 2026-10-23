"""Prometheus metrics for the Django app.

Exposes request rate / latency / status codes on ``/metrics`` (scraped by
Prometheus over the compose network, not through the public reverse proxy).
The collectors themselves live in :mod:`config.prometheus`, shared with the
FastAPI app.
"""

import time
from collections.abc import Callable

from django.http import HttpRequest, HttpResponse

from config.prometheus import (
    CONTENT_TYPE_LATEST,
    REQUEST_COUNT,
    REQUEST_LATENCY,
    UNMETERED_PATHS,
    render_metrics,
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


def metrics_view(request: HttpRequest) -> HttpResponse:
    return HttpResponse(render_metrics(), content_type=CONTENT_TYPE_LATEST)
