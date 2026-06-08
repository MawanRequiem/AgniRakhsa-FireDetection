import sys
import os

# Ensure test env vars are set BEFORE any app module imports,
# because app.core.config.Settings() is instantiated at import time.
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "test-key-do-not-use-in-prod")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch


@pytest.fixture
def sensor_snapshot_normal():
    """Normal room readings — all sensors within safe ranges."""
    return {
        "mq2": {"value": 200},
        "mq4": {"value": 250},
        "mq6": {"value": 150},
        "mq9b": {"value": 10},
        "flame": {"value": 3500},
        "shtc3_temp": {"value": 28},
        "shtc3_humidity": {"value": 60},
    }


@pytest.fixture
def sensor_snapshot_fire():
    """Dangerous readings — high gas, flame detected, high temperature."""
    return {
        "mq2": {"value": 800},
        "mq6": {"value": 2000},
        "flame": {"value": 500},
        "shtc3_temp": {"value": 70},
        "shtc3_humidity": {"value": 15},
    }


@pytest.fixture
def sensor_snapshot_warning():
    """Warning-level readings — at warning threshold to score ≥0.5."""
    return {
        "mq2": {"value": 600},       # at warning threshold → 0.5
        "flame": {"value": 2000},    # at warning threshold → 0.5
        "shtc3_temp": {"value": 55}, # at warning threshold → 0.5
        "shtc3_humidity": {"value": 35}, # at warning threshold → 0.5
    }
