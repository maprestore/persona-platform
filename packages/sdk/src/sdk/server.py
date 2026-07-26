from __future__ import annotations

import os
import struct
import fcntl
import uuid
import threading
from pathlib import Path

import numpy as np
from fastapi import FastAPI, WebSocket, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
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
    use_4k: bool = False
    no_watermark: bool = False


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


class VoiceCloneRequest(BaseModel):
    name: str
    file_id: str


class VoiceConvertRequest(BaseModel):
    file_id: str
    target_voice: str | None = None
    pitch_shift: float = 0.0


class LivePortraitRequest(BaseModel):
    source_id: str
    expression: str = "smile"
    intensity: float = 1.0
    num_frames: int = 30


class FilterRequest(BaseModel):
    file_id: str
    filter_name: str = "none"
    intensity: float = 1.0


class BackgroundRequest(BaseModel):
    file_id: str
    method: str = "auto"
    bg_color: str | None = None
    bg_file_id: str | None = None
    blur_kernel: int = 0


class TranslateRequest(BaseModel):
    file_id: str
    source_lang: str = "en"
    target_lang: str = "es"


class TuningRequest(BaseModel):
    face_align_strength: float = 1.0
    blend_ratio: float = 0.7
    color_correction: bool = True
    smoothness: float = 0.5
    edge_feathering: float = 0.3
    brightness_adapt: bool = True
    landmark_smoothing: bool = True


class EngineState:
    def __init__(self) -> None:
        self._engine = None
        self._translator = None
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

    def get_translator(self):
        if self._translator is None:
            from magiclip import MagiclipTranslator
            self._translator = MagiclipTranslator()
            self._translator.load(device="cpu")
        return self._translator

    def unload(self) -> None:
        if self._engine:
            self._engine.unload()
            self._loaded = False
        if self._translator:
            self._translator.unload()
            self._translator = None
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


def _parse_color(color_str: str | None) -> tuple[int, int, int] | None:
    if color_str is None:
        return None
    parts = color_str.split(",")
    if len(parts) == 3:
        try:
            return (int(parts[0]), int(parts[1]), int(parts[2]))
        except ValueError:
            return None
    return None


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

    @app.get("/features")
    async def features():
        return {
            "face_swap": True,
            "video_face_swap": True,
            "live_portrait": True,
            "voice_changer": True,
            "voice_cloning": True,
            "background_removal": True,
            "background_replacement": True,
            "filters": True,
            "virtual_camera": True,
            "magiclip_translate": True,
            "4k_hd": True,
            "advanced_tuning": True,
            "watermark": True,
            "multi_platform": True,
        }

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
            if req.use_4k:
                engine.set_4k_mode(True)
            if req.no_watermark:
                engine.set_watermark(False)

            from shared.types import VideoFrame
            source_frame = VideoFrame(image=source_img)
            target_frame = VideoFrame(image=target_img)
            result_frame = engine.swap(source_frame, target_frame)

            ext = ".png"
            if req.use_4k:
                ext = ".jpg"
            output_id = f"swap_{uuid.uuid4().hex[:12]}{ext}"
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

    @app.post("/swap-video")
    async def swap_video(source_id: str = Form(...), target_id: str = Form(...)):
        source_path = UPLOAD_DIR / source_id
        target_path = UPLOAD_DIR / target_id

        if not source_path.exists():
            raise HTTPException(status_code=404, detail="Source file not found")
        if not target_path.exists():
            raise HTTPException(status_code=404, detail="Target file not found")

        try:
            import cv2
            source_img = cv2.imread(str(source_path))
            cap = cv2.VideoCapture(str(target_path))

            fps = cap.get(cv2.CAP_PROP_FPS)
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

            output_id = f"swap_vid_{uuid.uuid4().hex[:12]}.mp4"
            output_path = OUTPUT_DIR / output_id

            fourcc = cv2.VideoWriter_fourcc(*"mp4v")
            out = cv2.VideoWriter(str(output_path), fourcc, fps, (w, h))

            engine = _engine_state.get_engine()
            from shared.types import VideoFrame
            source_frame = VideoFrame(image=source_img)

            frames_processed = 0
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                target_frame = VideoFrame(image=frame)
                result_frame = engine.swap(source_frame, target_frame)
                out.write(result_frame.image)
                frames_processed += 1

            cap.release()
            out.release()

            return {
                "status": "success",
                "output_id": output_id,
                "output_url": f"/outputs/{output_id}",
                "frames": frames_processed,
            }
        except ImportError:
            raise HTTPException(status_code=500, detail="opencv-python not installed")
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/live-portrait")
    async def live_portrait(req: LivePortraitRequest):
        source_path = UPLOAD_DIR / req.source_id
        if not source_path.exists():
            raise HTTPException(status_code=404, detail="Source file not found")

        try:
            import cv2
            source_img = cv2.imread(str(source_path))
            if source_img is None:
                raise HTTPException(status_code=400, detail="Cannot read source image")

            engine = _engine_state.get_engine()
            frames = engine.animate_portrait(source_img, req.expression, req.intensity)

            output_id = f"portrait_{uuid.uuid4().hex[:12]}.mp4"
            output_path = OUTPUT_DIR / output_id

            h, w = source_img.shape[:2]
            fourcc = cv2.VideoWriter_fourcc(*"mp4v")
            out = cv2.VideoWriter(str(output_path), fourcc, 30, (w, h))

            for frame in frames:
                out.write(frame)
            out.release()

            return {
                "status": "success",
                "output_id": output_id,
                "output_url": f"/outputs/{output_id}",
                "frames": len(frames),
            }
        except ImportError:
            raise HTTPException(status_code=500, detail="opencv-python not installed")
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/background-remove")
    async def background_remove(req: BackgroundRequest):
        file_path = UPLOAD_DIR / req.file_id
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")

        try:
            import cv2
            img = cv2.imread(str(file_path))
            if img is None:
                raise HTTPException(status_code=400, detail="Cannot read image")

            engine = _engine_state.get_engine()

            bg_img = None
            if req.bg_file_id:
                bg_path = UPLOAD_DIR / req.bg_file_id
                if bg_path.exists():
                    bg_img = cv2.imread(str(bg_path))

            bg_color = _parse_color(req.bg_color)

            if req.blur_kernel > 0:
                result = engine.blur_background(img, req.blur_kernel, req.method)
            elif bg_img is not None or bg_color is not None:
                result = engine.replace_background(img, bg_img, bg_color, req.method)
            else:
                _, result = engine.remove_background(img, req.method)

            output_id = f"bg_{uuid.uuid4().hex[:12]}.png"
            output_path = OUTPUT_DIR / output_id
            cv2.imwrite(str(output_path), result)

            return {
                "status": "success",
                "output_id": output_id,
                "output_url": f"/outputs/{output_id}",
            }
        except ImportError:
            raise HTTPException(status_code=500, detail="opencv-python not installed")
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/apply-filter")
    async def apply_filter(req: FilterRequest):
        file_path = UPLOAD_DIR / req.file_id
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")

        try:
            import cv2
            img = cv2.imread(str(file_path))
            if img is None:
                raise HTTPException(status_code=400, detail="Cannot read image")

            engine = _engine_state.get_engine()
            from shared.types import VideoFrame
            frame = VideoFrame(image=img)
            result = engine.apply_filter(frame, req.filter_name, req.intensity)

            output_id = f"filter_{uuid.uuid4().hex[:12]}.png"
            output_path = OUTPUT_DIR / output_id
            cv2.imwrite(str(output_path), result.image)

            return {
                "status": "success",
                "output_id": output_id,
                "output_url": f"/outputs/{output_id}",
            }
        except ImportError:
            raise HTTPException(status_code=500, detail="opencv-python not installed")
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.get("/filters")
    async def list_filters():
        engine = _engine_state.get_engine()
        return {"filters": engine.list_filters()}

    @app.post("/voice-clone/add")
    async def voice_clone_add(req: VoiceCloneRequest):
        file_path = UPLOAD_DIR / req.file_id
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")

        try:
            import soundfile as sf
            audio, sr = sf.read(str(file_path))
            if len(audio.shape) > 1:
                audio = audio.mean(axis=1)
            audio = audio.astype(np.float32)

            engine = _engine_state.get_engine()
            engine.add_voice_sample(req.name, audio, sr)

            return {"status": "success", "voice": req.name, "samples": len(audio)}
        except ImportError:
            raise HTTPException(status_code=500, detail="soundfile not installed")
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.get("/voice-clone/list")
    async def voice_clone_list():
        engine = _engine_state.get_engine()
        return {"voices": engine.list_voices()}

    @app.post("/voice-clone/convert")
    async def voice_clone_convert(req: VoiceConvertRequest):
        file_path = UPLOAD_DIR / req.file_id
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")

        try:
            import soundfile as sf
            audio, sr = sf.read(str(file_path))
            if len(audio.shape) > 1:
                audio = audio.mean(axis=1)
            audio = audio.astype(np.float32)

            engine = _engine_state.get_engine()
            from shared.types import AudioFrame
            audio_frame = AudioFrame(samples=audio, sample_rate=sr)

            if req.target_voice:
                result = engine.clone_voice(audio_frame, req.target_voice, req.pitch_shift)
            else:
                result = engine.convert_voice(audio_frame, req.target_voice)

            import tempfile
            output_id = f"voice_{uuid.uuid4().hex[:12]}.wav"
            output_path = OUTPUT_DIR / output_id
            sf.write(str(output_path), result.samples, sr)

            return {
                "status": "success",
                "output_id": output_id,
                "output_url": f"/outputs/{output_id}",
            }
        except ImportError:
            raise HTTPException(status_code=500, detail="soundfile not installed")
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/tuning")
    async def set_tuning(req: TuningRequest):
        from shared.types import TuningParams
        tuning = TuningParams(
            face_align_strength=req.face_align_strength,
            blend_ratio=req.blend_ratio,
            color_correction=req.color_correction,
            smoothness=req.smoothness,
            edge_feathering=req.edge_feathering,
            brightness_adapt=req.brightness_adapt,
            landmark_smoothing=req.landmark_smoothing,
        )
        engine = _engine_state.get_engine()
        engine.set_tuning(tuning)
        return {"status": "ok", "tuning": req.model_dump()}

    @app.post("/translate")
    async def translate(req: TranslateRequest):
        file_path = UPLOAD_DIR / req.file_id
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")

        try:
            import soundfile as sf
            audio, sr = sf.read(str(file_path))
            if len(audio.shape) > 1:
                audio = audio.mean(axis=1)
            audio = audio.astype(np.float32)

            translator = _engine_state.get_translator()
            translator.set_languages(req.source_lang, req.target_lang)
            text, tts_audio = translator.translate_audio(audio, sr)

            output_audio_id = None
            if tts_audio is not None:
                output_audio_id = f"trans_{uuid.uuid4().hex[:12]}.wav"
                output_path = OUTPUT_DIR / output_audio_id
                sf.write(str(output_path), tts_audio, 16000)

            return {
                "status": "success",
                "translated_text": text,
                "source_lang": req.source_lang,
                "target_lang": req.target_lang,
                "output_audio_id": output_audio_id,
                "output_audio_url": f"/outputs/{output_audio_id}" if output_audio_id else None,
            }
        except ImportError:
            raise HTTPException(status_code=500, detail="soundfile not installed")
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/watermark")
    async def toggle_watermark(enabled: bool = Form(...)):
        engine = _engine_state.get_engine()
        engine.set_watermark(enabled)
        return {"status": "ok", "watermark_enabled": enabled}

    @app.post("/upload")
    async def upload(file: UploadFile = File(...)):
        file_id = f"{uuid.uuid4().hex[:12]}_{file.filename}"
        file_path = UPLOAD_DIR / file_id
        content = await file.read()
        file_path.write_bytes(content)
        return {"file_id": file_id, "filename": file.filename, "size": len(content), "mime": file.content_type or "application/octet-stream"}

    @app.get("/files/{file_id}")
    async def get_file(file_id: str):
        file_path = UPLOAD_DIR / file_id
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
        return FileResponse(str(file_path))

    @app.get("/outputs/{output_id}")
    async def get_output(output_id: str):
        output_path = OUTPUT_DIR / output_id
        if not output_path.exists():
            raise HTTPException(status_code=404, detail="Output not found")
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
