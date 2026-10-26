"""Process logging, shared by every served entrypoint."""

import logging.config
from typing import Any

# One console handler on the root logger; containers ship stdout to Loki.
LOGGING: dict[str, Any] = {
    'version': 1,
    'disable_existing_loggers': False,
    'filters': {
        # Adds ``trace_id``/``span_id``; Grafana's Loki derived field turns
        # ``trace_id=<hex>`` into a link to the trace in Tempo.
        'trace_context': {'()': 'personal.infra.tracing.TraceContextFilter'},
    },
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} trace_id={trace_id} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
            'filters': ['trace_context'],
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
}


def configure_logging() -> None:
    logging.config.dictConfig(LOGGING)
