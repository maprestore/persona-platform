from __future__ import annotations

from fastapi import FastAPI, WebSocket, UploadFile, File
from pydantic import BaseModel


class SwapRequest(BaseModel):
    source_id: str
    target_id: str
    preserve_voice: bool = True


class SwapResponse(BaseModel):
    status: str
    output_url: str | None = None


def create_app() -> FastAPI:
    app = FastAPI(title="Persona Platform SDK", version="0.1.0")

    @app.get("/health")
    async def health():
        return {"status": "ok", "version": "0.1.0"}

    @app.post("/swap", response_model=SwapResponse)
    async def swap(req: SwapRequest) -> SwapResponse:
        return SwapResponse(status="not_implemented")

    @app.post("/upload")
    async def upload(file: UploadFile = File(...)):
        return {"filename": file.filename, "size": 0}

    @app.websocket("/stream")
    async def stream(ws: WebSocket):
        await ws.accept()
        while True:
            data = await ws.receive_bytes()
            await ws.send_bytes(data)

    return app