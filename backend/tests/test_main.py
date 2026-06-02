from fastapi.testclient import TestClient

def test_health_check(client: TestClient):
    """
    Test the root health check endpoint.
    """
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "agniraksha-backend"
    assert "version" in data
