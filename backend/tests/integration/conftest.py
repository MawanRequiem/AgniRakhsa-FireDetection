"""
Integration test fixtures — reusable mock factories for supabase, redis,
and authenticated/unauthenticated FastAPI TestClient.

Architecture note: backend uses global singletons. All mocking is done via
unittest.mock.patch targeting module-level imports (app.core.db.supabase,
app.core.redis.redis_manager, etc.).
"""

import sys
import os

os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "test-key-do-not-use-in-prod")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ═══════════════════════════════════════════════════════════════════════════════
# Supabase Mock Factory — chainable fluent API
# ═══════════════════════════════════════════════════════════════════════════════

class _QueryResult:
    """Plain object for .execute() return → avoids MagicMock attribute traps."""

    def __init__(self, data, count):
        self.data = data
        self.count = count


class SupabaseMock:
    """
    Reusable Supabase client mock that supports the chainable query pattern:
      supabase.table("x").select("*").eq("id", "1").order("created_at", desc=True).limit(1).execute()
    """

    def __init__(self):
        self._create_chainable()

    def _make_query_chain(self, default_data=None, default_count=0):
        """Returns a MagicMock chain that ends with .execute() → _QueryResult."""
        chain = MagicMock()
        chain_funcs = (
            "eq", "neq", "in_", "is_", "not_", "gte", "lte",
            "lt", "gt", "order", "limit", "range", "single",
            "select", "insert", "update", "delete", "upsert",
        )
        for fn in chain_funcs:
            setattr(chain, fn, MagicMock(return_value=chain))
        chain.execute = MagicMock(
            return_value=_QueryResult(
                data=default_data if default_data is not None else [],
                count=default_count,
            )
        )
        return chain

    def _create_chainable(self):
        """Build the mock supabase object with all common query patterns."""
        self.mock = MagicMock()

        self.mock.table = MagicMock()
        self.mock.table.return_value = self._make_query_chain()

        self.mock.rpc = MagicMock()
        self.mock.rpc.return_value = MagicMock(
            execute=MagicMock(return_value=_QueryResult(data=[], count=0))
        )

        storage_from = MagicMock()
        storage_from.upload = MagicMock()
        storage_from.download = MagicMock()
        storage_from.get_public_url = MagicMock(return_value="http://fake.url/img.jpg")
        storage_from.remove = MagicMock()
        self.mock.storage = MagicMock()
        self.mock.storage.from_.return_value = storage_from

    def reset(self, table_path=None):
        self._create_chainable()

    def set_query_result(self, table_name, data, count=None):
        c = count if count is not None else len(data)
        chain = self._make_query_chain(default_data=data, default_count=c)
        self.mock.table.return_value = chain

    def set_rpc_result(self, data):
        self.mock.rpc.return_value.execute.return_value = _QueryResult(
            data=data, count=len(data) if data else 0
        )

    def set_insert_result(self, data):
        chain = MagicMock()
        chain.execute.return_value = _QueryResult(data=data, count=len(data))
        self.mock.table.return_value.insert.return_value = chain

    def set_update_result(self, data):
        chain = MagicMock()
        chain.eq.return_value = chain
        chain.execute.return_value = _QueryResult(data=data, count=len(data))
        self.mock.table.return_value.update.return_value = chain


@pytest.fixture
def supabase_mock():
    """Singleton SupabaseMock instance per test — resets between tests."""
    sb = SupabaseMock()
    with patch("app.core.db.supabase", sb.mock):
        yield sb


# ═══════════════════════════════════════════════════════════════════════════════
# Redis Mock
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.fixture
def redis_mock():
    """Mock redis_manager with async client that returns no stream data."""
    with patch("app.core.redis.redis_manager") as mgr:
        async_client = AsyncMock()
        async_client.xread = AsyncMock(return_value=None)
        async_client.xadd = AsyncMock(return_value="msg-1")
        async_client.get = AsyncMock(return_value=None)
        async_client.set = AsyncMock(return_value=True)
        async_client.delete = AsyncMock(return_value=1)
        async_client.ping = AsyncMock(return_value=True)

        sync_client = MagicMock()
        sync_client.get.return_value = None
        sync_client.set.return_value = True

        mgr.get_async_client.return_value = async_client
        mgr.get_client.return_value = sync_client
        mgr.is_connected = True
        mgr.connect = MagicMock()
        yield mgr


# ═══════════════════════════════════════════════════════════════════════════════
# AI Registry Mock (prevents model loading during test startup)
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.fixture(autouse=True)
def _patch_registry():
    """Auto-applied — prevents AI model loading during test startup."""
    with patch("app.ai.registry.load_detector", MagicMock()):
        with patch("app.ai.registry.load_sensor_detector", MagicMock()):
            with patch("app.ai.registry.get_detector", MagicMock()):
                with patch("app.ai.registry.get_sensor_detector", MagicMock()):
                    yield


# ═══════════════════════════════════════════════════════════════════════════════
# Redis Connect Patch (prevents real Redis connection in lifespan)
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.fixture(autouse=True)
def _patch_redis_connect():
    """Auto-applied — prevents real Redis connection attempt in lifespan."""
    # main.py does: from app.core.redis import redis_manager
    # and calls redis_manager.connect() in lifespan
    with patch("app.core.redis.redis_manager.connect", MagicMock()):
        with patch("app.core.redis.redis_manager.is_connected", True):
            yield


# ═══════════════════════════════════════════════════════════════════════════════
# Background Task Suppression (prevents watchdog + fusion_worker from starting)
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.fixture(autouse=True)
def _patch_background_tasks():
    """Auto-applied — prevents watchdog and fusion_worker from starting."""
    with patch("app.services.device_watchdog.run_watchdog") as mock_wd:
        mock_wd.return_value = None
        with patch("app.services.fusion_worker.run_fusion_worker") as mock_fw:
            mock_fw.return_value = None
            yield


# ═══════════════════════════════════════════════════════════════════════════════
# WhatsApp Mock
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.fixture
def mock_whatsapp():
    """Mock send_whatsapp_message — returns success by default."""
    with patch("app.services.fusion_service.send_whatsapp_message") as mock:
        mock.return_value = True
        yield mock


# ═══════════════════════════════════════════════════════════════════════════════
# WebSocket Manager Mock
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.fixture
def mock_ws_manager():
    """Mock the WebSocket connection manager."""
    with patch("app.api.ws_manager.manager") as mock:
        mock.broadcast = AsyncMock()
        mock.push_telemetry_update = AsyncMock()
        yield mock


# ═══════════════════════════════════════════════════════════════════════════════
# FastAPI TestClient
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.fixture
def client(supabase_mock, redis_mock, mock_ws_manager, mock_whatsapp):
    """
    FastAPI TestClient with all singletons mocked.

    The TestClient's __enter__ triggers the FastAPI lifespan, but we've
    patched all heavy operations (Redis, AI models, background tasks).
    """
    from fastapi.testclient import TestClient
    from app.main import app

    with TestClient(app) as c:
        yield c


# ═══════════════════════════════════════════════════════════════════════════════
# Auth Helpers
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.fixture
def auth_headers():
    """
    Return headers/cookies for an authenticated request.

    Returns a dict with cookie + csrf header. Use with client.get/post.
    """
    import secrets
    from app.core.security import create_access_token

    csrf = secrets.token_urlsafe(32)
    token = create_access_token(subject="test-user-id", csrf_token=csrf)

    return {
        "cookie": f"access_token=Bearer {token}",
        "csrf": csrf,
    }


@pytest.fixture
def auth_client(client, supabase_mock, auth_headers):
    """
    TestClient preset with authenticated cookie + mocked /me user lookup.

    Call .get() / .post() with the auth headers already set via cookies.
    """
    # Set up the /me endpoint to return a valid user when called
    supabase_mock.set_query_result("users", [{
        "id": "test-user-id",
        "email": "admin@agniraksha.local",
        "role": "admin",
        "is_active": True,
    }])

    # Set the access_token cookie on the client
    client.cookies.set("access_token", auth_headers["cookie"].split("=", 1)[1])
    return client


# ═══════════════════════════════════════════════════════════════════════════════
# Helper: build_auth_headers
# ═══════════════════════════════════════════════════════════════════════════════

def build_auth_headers():
    """Create auth cookie + CSRF header for a test user."""
    import secrets
    from app.core.security import create_access_token

    csrf = secrets.token_urlsafe(32)
    token = create_access_token(subject="test-user-id", csrf_token=csrf)
    return {
        "Cookie": f"access_token=Bearer {token}",
        "X-CSRF-Token": csrf,
    }
