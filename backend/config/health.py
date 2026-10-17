"""Health endpoints for the deployment stack.

``/health``       - liveness: the process answers, no dependencies touched.
``/health/ready`` - readiness: also verifies the database connection.
"""

import logging

from django.db import connection
from django.http import JsonResponse

logger = logging.getLogger(__name__)


def health_view(request):
    return JsonResponse({'status': 'ok'})


def readiness_view(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
            cursor.fetchone()
    except Exception:
        logger.exception('Readiness check failed: the database is unavailable')
        return JsonResponse(
            {'status': 'unavailable', 'database': 'error'},
            status=503,
        )

    return JsonResponse({'status': 'ok', 'database': 'ok'})
