"""Endpoint tests that need a fixed clock."""

from typing import Any

import pytest

from personal.core.work import clock
from tests.entrypoints.http.routers.helpers import FIXED_NOW


@pytest.fixture
def fixed_clock(monkeypatch: Any) -> Any:
    monkeypatch.setattr(clock, 'now', lambda: FIXED_NOW)
