"""Shared helpers for the time-tracking endpoint tests."""

from datetime import datetime, timezone
from typing import Any

FIXED_NOW = datetime(2026, 10, 14, 12, 0, 0, tzinfo=timezone.utc)


def create_task(post_json: Any, title: Any='Outline the release', project_name: Any='Planning') -> Any:
    project_id = post_json('/api/v1/projects/', {'name': project_name}).json()['id']
    return post_json(
        '/api/v1/tasks/', {'title': title, 'project': project_id}
    ).json()
