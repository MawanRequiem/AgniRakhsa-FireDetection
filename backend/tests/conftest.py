import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock, MagicMock

# Set environment to testing before importing app
import os
os.environ["ENVIRONMENT"] = "testing"

from app.main import app

@pytest.fixture(scope="session", autouse=True)
def mock_external_services():
    """
    Mock external connections and background tasks for all tests.
    This runs before the TestClient triggers the lifespan events.
    """
    with patch("app.main.redis_manager.connect", MagicMock()) as mock_redis, \
         patch("app.main.registry.load_detector", MagicMock()) as mock_detector, \
         patch("app.main.registry.load_sensor_detector", MagicMock()) as mock_sensor, \
         patch("app.main.run_watchdog", AsyncMock()) as mock_watchdog, \
         patch("app.main.run_fusion_worker", AsyncMock()) as mock_fusion:
        yield

@pytest.fixture(scope="module")
def client():
    """
    Provides a FastAPI TestClient instance.
    Using TestClient within a context manager triggers startup/shutdown lifespan events.
    """
    with TestClient(app) as test_client:
        yield test_client
