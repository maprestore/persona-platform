from __future__ import annotations

import httpx
from pydantic import BaseModel


class SwapRequest(BaseModel):
    source_id: str
    target_id: str
    preserve_voice: bool = True


class PersonaClient:
    def __init__(self, base_url: str = "http://localhost:6967"):
        self.base_url = base_url
        self._client = httpx.Client(timeout=30)

    def health(self) -> dict:
        resp = self._client.get(f"{self.base_url}/health")
        resp.raise_for_status()
        return resp.json()

    def swap(self, source_id: str, target_id: str, preserve_voice: bool = True) -> dict:
        req = SwapRequest(source_id=source_id, target_id=target_id, preserve_voice=preserve_voice)
        resp = self._client.post(f"{self.base_url}/swap", json=req.model_dump())
        resp.raise_for_status()
        return resp.json()

    def close(self) -> None:
        self._client.close()