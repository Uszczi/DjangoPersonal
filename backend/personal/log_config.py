"""Process logging, shared by every served entrypoint."""

import logging.config
from typing import Any

# One console handler on the root logger; containers ship stdout to Loki.
LOGGING: dict[str, Any] = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
}


def configure_logging() -> None:
    logging.config.dictConfig(LOGGING)
