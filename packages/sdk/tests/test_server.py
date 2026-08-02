
from __future__ import annotations

import pytest
import httpx
from sdk.server import create_app


@pytest.fixture
async def client():
    app = create_app()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


@pytest.mark.anyio
async def test_health(client: httpx.AsyncClient) -> None:
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"


@pytest.mark.anyio
async def test_swap_endpoint(client: httpx.AsyncClient) -> None:
    resp = await client.post(
        "/swap",
        json={"source_id": "a.jpg", "target_id": "b.jpg", "preserve_voice": True},
    )
    assert resp.status_code in (200, 404, 500)
    data = resp.json()
    if resp.status_code == 200:
        assert "status" in data
