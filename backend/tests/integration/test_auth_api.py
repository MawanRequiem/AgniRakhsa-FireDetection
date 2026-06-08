"""
Integration tests for Auth API — login, session check, logout, cookie/CSRF flow.

All external I/O (Supabase, Redis, AI models, background tasks) is mocked
via the fixtures in conftest.py.
"""

import json
import pytest
from app.core.security import create_access_token, verify_password, get_password_hash
from tests.integration.conftest import build_auth_headers


# ═══════════════════════════════════════════════════════════════════════════════
# POST /api/v1/auth/login
# ═══════════════════════════════════════════════════════════════════════════════

class TestLogin:
    """POST /api/v1/auth/login — credentials → cookie + CSRF token."""

    def test_login_success(self, client, supabase_mock):
        """Valid credentials return CSRF token and set HttpOnly cookie."""
        supabase_mock.set_query_result("users", [{
            "id": "user-1",
            "email": "admin@test.local",
            "password_hash": get_password_hash("correct-password"),
            "role": "admin",
            "is_active": True,
        }])

        resp = client.post("/api/v1/auth/login", data={
            "username": "admin@test.local",
            "password": "correct-password",
        })

        assert resp.status_code == 200
        body = resp.json()
        assert "csrf_token" in body
        assert body["user"]["email"] == "admin@test.local"
        assert body["user"]["role"] == "admin"

        # Cookie harus diset
        cookies = resp.headers.get("set-cookie", "")
        assert "access_token" in cookies
        assert "HttpOnly" in cookies

    def test_login_wrong_password(self, client, supabase_mock):
        """Wrong password returns 401."""
        supabase_mock.set_query_result("users", [{
            "id": "user-1",
            "email": "admin@test.local",
            "password_hash": get_password_hash("correct-password"),
            "role": "admin",
            "is_active": True,
        }])

        resp = client.post("/api/v1/auth/login", data={
            "username": "admin@test.local",
            "password": "wrong-password",
        })

        assert resp.status_code == 401
        assert "Incorrect" in resp.json()["detail"]

    def test_login_nonexistent_user(self, client, supabase_mock):
        """Non-existent email returns 401."""
        supabase_mock.set_query_result("users", [])

        resp = client.post("/api/v1/auth/login", data={
            "username": "ghost@test.local",
            "password": "anything",
        })

        assert resp.status_code == 401

    def test_login_inactive_user(self, client, supabase_mock):
        """Inactive user returns 400."""
        supabase_mock.set_query_result("users", [{
            "id": "user-1",
            "email": "disabled@test.local",
            "password_hash": get_password_hash("correct-password"),
            "role": "admin",
            "is_active": False,
        }])

        resp = client.post("/api/v1/auth/login", data={
            "username": "disabled@test.local",
            "password": "correct-password",
        })

        assert resp.status_code == 400
        assert "inactive" in resp.json()["detail"].lower()


# ═══════════════════════════════════════════════════════════════════════════════
# GET /api/v1/auth/me
# ═══════════════════════════════════════════════════════════════════════════════

class TestMe:
    """GET /api/v1/auth/me — session check, returns user profile."""

    def test_me_authenticated(self, client, supabase_mock):
        """Authenticated user gets their profile back."""
        headers = build_auth_headers()
        supabase_mock.set_query_result("users", [{
            "id": "test-user-id",
            "email": "admin@test.local",
            "role": "admin",
            "is_active": True,
        }])

        resp = client.get("/api/v1/auth/me", headers={
            "Cookie": headers["Cookie"],
        })

        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == "test-user-id"
        assert body["email"] == "admin@test.local"
        assert body["role"] == "admin"
        # X-CSRF-Token header should be exposed
        assert "X-CSRF-Token" in resp.headers.get("Access-Control-Expose-Headers", "")

    def test_me_no_cookie(self, client):
        """No cookie → 401."""
        resp = client.get("/api/v1/auth/me")
        assert resp.status_code == 401

    def test_me_invalid_token(self, client):
        """Tampered cookie → 403."""
        resp = client.get("/api/v1/auth/me", headers={
            "Cookie": "access_token=Bearer totally-fake-jwt-token-here",
        })
        assert resp.status_code == 403

    def test_me_inactive_user(self, client, supabase_mock):
        """Active token but user is inactive → 400."""
        headers = build_auth_headers()
        supabase_mock.set_query_result("users", [{
            "id": "test-user-id",
            "email": "disabled@test.local",
            "role": "admin",
            "is_active": False,
        }])

        resp = client.get("/api/v1/auth/me", headers={
            "Cookie": headers["Cookie"],
        })

        assert resp.status_code == 400


# ═══════════════════════════════════════════════════════════════════════════════
# POST /api/v1/auth/logout
# ═══════════════════════════════════════════════════════════════════════════════

class TestLogout:
    """POST /api/v1/auth/logout — clears access_token cookie."""

    def test_logout_clears_cookie(self, client):
        """Logout deletes the access_token cookie."""
        resp = client.post("/api/v1/auth/logout")

        assert resp.status_code == 200
        assert resp.json()["message"] == "Successfully logged out"

        cookies = resp.headers.get("set-cookie", "")
        assert "access_token" in cookies
        # Cookie should be cleared (max-age=0 or expires in past)
        assert "Max-Age=0" in cookies or '""' in cookies


# ═══════════════════════════════════════════════════════════════════════════════
# CSRF Protection
# ═══════════════════════════════════════════════════════════════════════════════

class TestCSRF:
    """CSRF token validation for state-changing requests."""

    def test_mutating_request_needs_csrf(self, client, supabase_mock):
        """PATCH without CSRF header → 403."""
        headers = build_auth_headers()
        supabase_mock.set_query_result("users", [{
            "id": "test-user-id",
            "email": "admin@test.local",
            "role": "admin",
            "is_active": True,
        }])

        # Send PATCH with cookie but WITHOUT X-CSRF-Token header
        resp = client.patch("/api/v1/alerts/fake-id/acknowledge", headers={
            "Cookie": headers["Cookie"],
            # Missing X-CSRF-Token
        })

        assert resp.status_code in (403, 401)

    def test_mutating_request_with_wrong_csrf(self, client, supabase_mock):
        """PATCH with wrong CSRF token → 403."""
        headers = build_auth_headers()
        supabase_mock.set_query_result("users", [{
            "id": "test-user-id",
            "email": "admin@test.local",
            "role": "admin",
            "is_active": True,
        }])

        resp = client.patch("/api/v1/alerts/fake-id/acknowledge", headers={
            "Cookie": headers["Cookie"],
            "X-CSRF-Token": "wrong-csrf-value",
        })

        assert resp.status_code in (403, 401)
