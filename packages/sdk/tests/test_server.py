from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sdk.server import create_app


@pytest.fixture
def client() -> TestClient:
    app = create_app()
    return TestClient(app)


def test_health(client: TestClient) -> None:
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"


def test_swap_endpoint(client: TestClient) -> None:
    resp = client.post(
        "/swap",
        json={"source_id": "a.jpg", "target_id": "b.jpg", "preserve_voice": True},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "not_implemented"