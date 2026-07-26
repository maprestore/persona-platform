from __future__ import annotations

import os
import struct
import fcntl
import uuid
import threading
from pathlib import Path

import numpy as np
from fastapi import FastAPI, WebSocket, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

UPLOAD_DIR = Path("uploads")
OUTPUT_DIR = Path("outputs")
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

V4L2_CAP_VIDEO_OUTPUT = 0x00000001
VIDIOC_QUERYCAP = 0x80685600

CAMERA_DEVICES = [f"/dev/video{i}" for i in range(16)]


class SwapRequest(BaseModel):
    source_id: str
    target_id: str
    preserve_voice: bool = True
    device: str = "cpu"


class SwapResponse(BaseModel):
    status: str
    output_id: str | None = None
    output_url: str | None = None
    message: str | None = None


class VirtualCamRequest(BaseModel):
    device: str = "/dev/video0"
    width: int = 1280
    height: int = 720
    fps: int = 30


class EngineState:
    def __init__(self) -> None:
        self._engine = None
        self._loaded = False
        self._virtual_cam = None
        self._virtual_cam_thread: threading.Thread | None = None
        self._cam_active = False

    def get_engine(self):
        if not self._loaded:
            from persona_swap_core import PersonaSwapCore
            self._engine = PersonaSwapCore()
            self._engine.load(device="cpu")
            self._loaded = True
        return self._engine

    def unload(self) -> None:
        if self._engine:
            self._engine.unload()
            self._loaded = False
        self.stop_virtual_cam()

    def stop_virtual_cam(self) -> None:
        self._cam_active = False
        if self._virtual_cam:
            try:
                self._virtual_cam.stop()
            except Exception:
                pass
            self._virtual_cam = None


_engine_state = EngineState()


def _detect_cameras() -> list[dict]:
    cameras = []
    for dev in CAMERA_DEVICES:
        if not os.path.exists(dev):
            continue
        info = {"device": dev, "name": f"Camera {dev}", "type": "unknown", "driver": ""}
        try:
            fd = os.open(dev, os.O_RDWR | os.O_NONBLOCK)
            cap = struct.pack("I32s32s32s2I", 0, b"", b"", b"", 0, 0)
            result = fcntl.ioctl(fd, VIDIOC_QUERYCAP, cap)
            caps = struct.unpack("I32s32s32s2I", result)
            driver = caps[1].rstrip(b"\x00").decode("utf-8", errors="replace")
            name = caps[2].rstrip(b"\x00").decode("utf-8", errors="replace")
            info["driver"] = driver
            info["name"] = name or f"Device {dev}"

            if "v4l2loopback" in driver.lower() or "loopback" in driver.lower():
                info["type"] = "v4l2loopback"
            elif "obs" in driver.lower():
                info["type"] = "obs_virtual"
            elif "manycam" in driver.lower() or "manycam" in name.lower():
                info["type"] = "manycam"
            elif caps[4] & V4L2_CAP_VIDEO_OUTPUT:
                info["type"] = "virtual_output"
            else:
                info["type"] = "capture"

            os.close(fd)
        except (OSError, PermissionError):
            info["type"] = "inaccessible"
        cameras.append(info)
    return cameras


def create_app() -> FastAPI:
    app = FastAPI(title="Persona Platform SDK", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.on_event("shutdown")
    async def shutdown():
        _engine_state.unload()

    @app.get("/health")
    async def health():
        return {"status": "ok", "version": "0.1.0"}

    @app.get("/cameras")
    async def list_cameras():
        cameras = _detect_cameras()
        return {"cameras": cameras}

    @app.post("/virtual-cam/start")
    async def start_virtual_cam(req: VirtualCamRequest):
        try:
            from persona_swap_core.virtual_cam import V4L2VirtualCamera
            cam = V4L2VirtualCamera(req.device, req.width, req.height, req.fps)
            if cam.is_available():
                ok = cam.start()
                if ok:
                    _engine_state._virtual_cam = cam
                    _engine_state._cam_active = True
                    return {"status": "ok", "device": req.device, "resolution": f"{req.width}x{req.height}", "fps": req.fps}
                return {"status": "error", "message": "Failed to start virtual camera"}
            return {"status": "error", "message": f"Device {req.device} not found or not a virtual output"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    @app.post("/virtual-cam/stop")
    async def stop_virtual_cam():
        _engine_state.stop_virtual_cam()
        return {"status": "ok"}

    @app.get("/virtual-cam/status")
    async def virtual_cam_status():
        active = _engine_state._cam_active
        device = _engine_state._virtual_cam.device if _engine_state._virtual_cam else None
        return {"active": active, "device": device}

    @app.post("/swap", response_model=SwapResponse)
    async def swap(req: SwapRequest) -> SwapResponse:
        source_path = UPLOAD_DIR / req.source_id
        target_path = UPLOAD_DIR / req.target_id

        if not source_path.exists():
            raise HTTPException(status_code=404, detail=f"Source file not found: {req.source_id}")
        if not target_path.exists():
            raise HTTPException(status_code=404, detail=f"Target file not found: {req.target_id}")

        try:
            import cv2
            source_img = cv2.imread(str(source_path))
            target_img = cv2.imread(str(target_path))

            if source_img is None:
                raise HTTPException(status_code=400, detail="Cannot read source image")
            if target_img is None:
                raise HTTPException(status_code=400, detail="Cannot read target image")

            engine = _engine_state.get_engine()
            from shared.types import VideoFrame
            source_frame = VideoFrame(image=source_img)
            target_frame = VideoFrame(image=target_img)
            result_frame = engine.swap(source_frame, target_frame)

            output_id = f"swap_{uuid.uuid4().hex[:12]}.png"
            output_path = OUTPUT_DIR / output_id
            cv2.imwrite(str(output_path), result_frame.image)

            if _engine_state._cam_active and _engine_state._virtual_cam:
                try:
                    _engine_state._virtual_cam.send(result_frame.image)
                except Exception:
                    pass

            return SwapResponse(
                status="success",
                output_id=output_id,
                output_url=f"/outputs/{output_id}",
            )
        except ImportError:
            raise HTTPException(status_code=500, detail="opencv-python not installed")
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/upload")
    async def upload(file: UploadFile = File(...)):
        file_id = f"{uuid.uuid4().hex[:12]}_{file.filename}"
        file_path = UPLOAD_DIR / file_id
        content = await file.read()
        file_path.write_bytes(content)
        return {"file_id": file_id, "filename": file.filename, "size": len(content)}

    @app.get("/files/{file_id}")
    async def get_file(file_id: str):
        file_path = UPLOAD_DIR / file_id
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
        from fastapi.responses import FileResponse
        return FileResponse(str(file_path))

    @app.get("/outputs/{output_id}")
    async def get_output(output_id: str):
        output_path = OUTPUT_DIR / output_id
        if not output_path.exists():
            raise HTTPException(status_code=404, detail="Output not found")
        from fastapi.responses import FileResponse
        return FileResponse(str(output_path))

    @app.websocket("/stream")
    async def stream(ws: WebSocket):
        await ws.accept()
        engine = _engine_state.get_engine()
        try:
            while True:
                data = await ws.receive_bytes()
                arr = np.frombuffer(data, dtype=np.uint8)
                try:
                    import cv2
                    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                    if img is not None:
                        from shared.types import VideoFrame
                        frame = VideoFrame(image=img)
                        result = engine.swap(frame, frame)

                        if _engine_state._cam_active and _engine_state._virtual_cam:
                            try:
                                _engine_state._virtual_cam.send(result.image)
                            except Exception:
                                pass

                        _, buf = cv2.imencode(".jpg", result.image)
                        await ws.send_bytes(buf.tobytes())
                    else:
                        await ws.send_bytes(data)
                except ImportError:
                    await ws.send_bytes(data)
        except Exception:
            pass

    return app
