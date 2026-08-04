
from __future__ import annotations

import asyncio
import json
import os
import time
import uuid
import threading
import logging
from contextlib import asynccontextmanager
from pathlib import Path

import numpy as np
import numpy.typing as npt
from fastapi import FastAPI, WebSocket, UploadFile, File, HTTPException, Form, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from shared.errors import FeatureUnavailableError, MediaProcessingError
from shared.utils import detect_cameras

logger = logging.getLogger(__name__)

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
UPLOAD_DIR = _PROJECT_ROOT / "uploads"
OUTPUT_DIR = _PROJECT_ROOT / "outputs"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

MAX_UPLOAD_BYTES = 100 * 1024 * 1024
ALLOWED_UPLOAD_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif",
    ".mp4", ".mov", ".avi", ".mkv", ".webm",
    ".wav", ".mp3", ".m4a", ".flac",
}

CORS_ORIGINS = os.environ.get("PERSONA_CORS_ORIGINS", "*").split(",")


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
    width: int = Field(default=1280, ge=16, le=7680)
    height: int = Field(default=720, ge=16, le=4320)
    fps: int = Field(default=30, ge=1, le=120)


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
    intensity: float = Field(default=1.0, ge=0.0, le=2.0)
    num_frames: int = Field(default=30, ge=1, le=600)


class FilterRequest(BaseModel):
    file_id: str
    filter_name: str = "none"
    intensity: float = Field(default=1.0, ge=0.0, le=2.0)


class BackgroundRequest(BaseModel):
    file_id: str
    method: str = "auto"
    bg_color: str | None = None
    bg_file_id: str | None = None
    blur_kernel: int = Field(default=0, ge=0, le=199)


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


class VideoRoom:
    """Multi-party video call room with face-swap processing."""

    def __init__(self, room_id: str, name: str, max_participants: int = 8):
        self.room_id = room_id
        self.name = name
        self.max_participants = max_participants
        self.created_at = time.time()
        self.participants: dict[str, "RoomParticipant"] = {}
        self._lock = threading.Lock()

    def add_participant(self, participant: "RoomParticipant") -> bool:
        with self._lock:
            if len(self.participants) >= self.max_participants:
                return False
            self.participants[participant.user_id] = participant
            return True

    def remove_participant(self, user_id: str) -> None:
        with self._lock:
            self.participants.pop(user_id, None)

    def get_participant_list(self) -> list[dict]:
        with self._lock:
            return [
                {
                    "user_id": p.user_id,
                    "name": p.name,
                    "muted": p.muted,
                    "video_off": p.video_off,
                    "joined_at": p.joined_at,
                }
                for p in self.participants.values()
            ]

    async def broadcast_frame(self, sender_id: str, frame_bytes: bytes, tracking: dict | None = None) -> None:
        """Send processed frame to all participants except sender."""
        with self._lock:
            targets = [
                p for uid, p in self.participants.items()
                if uid != sender_id and p.ws is not None and not p.video_off
            ]
        for p in targets:
            try:
                await p.ws.send_bytes(frame_bytes)
                if tracking:
                    await p.ws.send_json({"tracking": tracking, "from": sender_id})
            except Exception:
                pass

    async def broadcast_audio(self, sender_id: str, audio_bytes: bytes) -> None:
        """Forward audio to all participants except sender."""
        with self._lock:
            targets = [
                p for uid, p in self.participants.items()
                if uid != sender_id and p.ws is not None and not p.muted
            ]
        for p in targets:
            try:
                await p.ws.send_bytes(audio_bytes)
            except Exception:
                pass

    async def broadcast_system(self, message: dict, exclude: str | None = None) -> None:
        """Send a JSON system message to all participants."""
        with self._lock:
            targets = [
                p for uid, p in self.participants.items()
                if uid != exclude and p.ws is not None
            ]
        for p in targets:
            try:
                await p.ws.send_json(message)
            except Exception:
                pass


class RoomParticipant:
    """A participant in a video room."""

    def __init__(self, user_id: str, name: str, ws: WebSocket):
        self.user_id = user_id
        self.name = name
        self.ws = ws
        self.muted = False
        self.video_off = False
        self.joined_at = time.time()


class RoomManager:
    """Manages all active video rooms."""

    def __init__(self):
        self._rooms: dict[str, VideoRoom] = {}
        self._lock = threading.Lock()

    def create_room(self, name: str | None = None, max_participants: int = 8) -> VideoRoom:
        room_id = uuid.uuid4().hex[:8]
        with self._lock:
            while room_id in self._rooms:
                room_id = uuid.uuid4().hex[:8]
            room = VideoRoom(room_id, name or f"Room {room_id}", max_participants)
            self._rooms[room_id] = room
        return room

    def get_room(self, room_id: str) -> VideoRoom | None:
        with self._lock:
            return self._rooms.get(room_id)

    def delete_room(self, room_id: str) -> bool:
        with self._lock:
            if room_id in self._rooms:
                del self._rooms[room_id]
                return True
            return False

    def list_rooms(self) -> list[dict]:
        with self._lock:
            return [
                {
                    "room_id": r.room_id,
                    "name": r.name,
                    "participants": len(r.participants),
                    "max_participants": r.max_participants,
                    "created_at": r.created_at,
                }
                for r in self._rooms.values()
            ]


_room_manager = RoomManager()


class EngineState:
    def __init__(self) -> None:
        self._engine = None
        self._translator = None
        self._loaded = False
        self._virtual_cam = None
        self._virtual_cam_thread: threading.Thread | None = None
        self._cam_active = False
        self._lock = threading.Lock()
        self._engine_lock = threading.Lock()

    def get_engine(self):
        if self._loaded and self._engine is not None:
            return self._engine
        with self._engine_lock:
            if self._loaded and self._engine is not None:
                return self._engine
            from persona_swap_core import PersonaSwapCore

            self._engine = PersonaSwapCore()
            self._engine.load(device="cpu")
            self._loaded = True
            return self._engine

    def get_translator(self):
        if self._translator is not None:
            return self._translator
        with self._engine_lock:
            if self._translator is not None:
                return self._translator
            from magiclip import MagiclipTranslator

            self._translator = MagiclipTranslator()
            self._translator.load(device="cpu")
            return self._translator

    def translator_available(self) -> bool:
        try:
            return bool(self.get_translator().available)
        except (ImportError, AttributeError):
            return False

    def unload(self) -> None:
        with self._engine_lock:
            if self._engine:
                self._engine.unload()
                self._loaded = False
            if self._translator:
                self._translator.unload()
                self._translator = None
            self.stop_virtual_cam()

    def send_virtual_cam(self, frame: npt.NDArray[np.uint8]) -> None:
        with self._lock:
            if self._cam_active and self._virtual_cam:
                try:
                    if not self._virtual_cam.send(frame):
                        logger.warning("virtual camera rejected a frame")
                except Exception:
                    logger.exception("virtual camera send failed")

    def stop_virtual_cam(self) -> None:
        with self._lock:
            self._cam_active = False
            if self._virtual_cam:
                try:
                    self._virtual_cam.stop()
                except Exception:
                    logger.exception("virtual camera stop failed")
                self._virtual_cam = None

    def start_virtual_cam(self, cam) -> None:
        with self._lock:
            self._virtual_cam = cam
            self._cam_active = True

    def get_virtual_cam_status(self) -> dict:
        with self._lock:
            return {
                "active": self._cam_active,
                "device": self._virtual_cam.name if self._virtual_cam else None,
            }


_engine_state = EngineState()


def _safe_storage_path(directory: Path, file_id: str) -> Path:
    """Resolve an application-owned file without allowing path traversal."""
    candidate = Path(file_id)
    if candidate.name != file_id or candidate.is_absolute() or "\x00" in file_id:
        raise HTTPException(status_code=400, detail="Invalid file id")
    resolved = (directory / candidate).resolve()
    root = directory.resolve()
    if resolved.parent != root:
        raise HTTPException(status_code=400, detail="Invalid file id")
    return resolved


def _validate_color(color_str: str | None) -> tuple[int, int, int] | None:
    color = _parse_color(color_str)
    if color is None or any(channel < 0 or channel > 255 for channel in color):
        raise HTTPException(status_code=422, detail="bg_color must be r,g,b with values from 0 to 255")
    return color

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


FRONTEND_DIST = _PROJECT_ROOT / "packages" / "no-code-pipeline" / "frontend" / "dist"
FRONTEND_DEV = _PROJECT_ROOT / "packages" / "no-code-pipeline" / "frontend"

WEBPAGE_INDEX = """\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Persona Studio</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --bg-primary:#09090b;--bg-secondary:#18181b;--bg-card:#0c0c0f;
  --border:#27272a;--border-hover:#3f3f46;
  --text-primary:#fafafa;--text-secondary:#a1a1aa;--text-muted:#52525b;
  --accent:#6366f1;--accent-light:#818cf8;--accent-glow:rgba(99,102,241,.15);
  --green:#22c55e;--green-glow:rgba(34,197,94,.15);
  --purple:#a855f7;--purple-glow:rgba(168,85,247,.15);
  --pink:#ec4899;--pink-glow:rgba(236,72,153,.15);
  --cyan:#06b6d4;--cyan-glow:rgba(6,182,212,.15);
  --orange:#f97316;--orange-glow:rgba(249,115,22,.15);
}
body{font-family:'Inter',system-ui,-apple-system,sans-serif;background:var(--bg-primary);color:var(--text-primary);min-height:100vh;overflow-x:hidden}

/* Animated background */
.bg-grid{position:fixed;inset:0;background-image:
  linear-gradient(rgba(99,102,241,.03) 1px,transparent 1px),
  linear-gradient(90deg,rgba(99,102,241,.03) 1px,transparent 1px);
  background-size:64px 64px;z-index:0;animation:gridMove 20s linear infinite}
@keyframes gridMove{0%{transform:translate(0,0)}100%{transform:translate(64px,64px)}}

.bg-glow{position:fixed;width:600px;height:600px;border-radius:50%;filter:blur(150px);opacity:.07;z-index:0;pointer-events:none}
.bg-glow-1{background:#6366f1;top:-200px;left:-100px;animation:float1 8s ease-in-out infinite}
.bg-glow-2{background:#a855f7;bottom:-200px;right:-100px;animation:float2 10s ease-in-out infinite}
.bg-glow-3{background:#06b6d4;top:50%;left:50%;transform:translate(-50%,-50%);animation:float3 12s ease-in-out infinite}
@keyframes float1{0%,100%{transform:translate(0,0)}50%{transform:translate(60px,40px)}}
@keyframes float2{0%,100%{transform:translate(0,0)}50%{transform:translate(-50px,-30px)}}
@keyframes float3{0%,100%{transform:translate(-50%,-50%) scale(1)}50%{transform:translate(-50%,-50%) scale(1.2)}}

.content{position:relative;z-index:1}

/* Header */
.header{padding:20px 32px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);backdrop-filter:blur(20px);background:rgba(9,9,11,.6);position:sticky;top:0;z-index:100}
.header-left{display:flex;align-items:center;gap:14px}
.logo{width:42px;height:42px;background:linear-gradient(135deg,var(--accent),var(--purple));border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;box-shadow:0 0 30px var(--accent-glow);transition:transform .3s,box-shadow .3s}
.logo:hover{transform:scale(1.1) rotate(-5deg);box-shadow:0 0 40px rgba(99,102,241,.3)}
.header h1{font-size:22px;font-weight:700;letter-spacing:-.5px}
.header h1 span{background:linear-gradient(135deg,var(--accent-light),var(--purple));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.status-pill{display:flex;align-items:center;gap:8px;padding:8px 16px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:100px;font-size:13px;color:var(--text-secondary)}
.status-dot{width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 12px var(--green);animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(.8)}}

/* Hero */
.hero{padding:80px 32px 60px;text-align:center;max-width:800px;margin:0 auto}
.hero-badge{display:inline-flex;align-items:center;gap:8px;padding:6px 16px;background:var(--accent-glow);border:1px solid rgba(99,102,241,.2);border-radius:100px;font-size:12px;font-weight:500;color:var(--accent-light);margin-bottom:24px;animation:fadeUp .6s ease}
.hero-badge span{font-size:14px}
.hero h2{font-size:52px;font-weight:800;letter-spacing:-1.5px;line-height:1.1;margin-bottom:20px;animation:fadeUp .6s ease .1s both}
.hero h2 .gradient{background:linear-gradient(135deg,var(--accent-light),var(--purple),var(--pink));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-size:200% 200%;animation:gradientShift 4s ease infinite}
@keyframes gradientShift{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
.hero p{font-size:18px;color:var(--text-secondary);line-height:1.7;max-width:600px;margin:0 auto 40px;animation:fadeUp .6s ease .2s both}
@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}

.hero-actions{display:flex;gap:16px;justify-content:center;animation:fadeUp .6s ease .3s both}
.btn{padding:14px 32px;border-radius:12px;font-size:15px;font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:10px;transition:all .3s;cursor:pointer;border:none;font-family:inherit}
.btn-primary{background:linear-gradient(135deg,var(--accent),#7c3aed);color:#fff;box-shadow:0 0 30px var(--accent-glow)}
.btn-primary:hover{transform:translateY(-2px);box-shadow:0 0 50px rgba(99,102,241,.3)}
.btn-secondary{background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--border)}
.btn-secondary:hover{border-color:var(--border-hover);transform:translateY(-2px)}
.btn-icon{font-size:20px}

/* Features Grid */
.features{padding:20px 32px 80px;max-width:1100px;margin:0 auto}
.section-label{text-align:center;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:2px;color:var(--accent-light);margin-bottom:12px}
.section-title{text-align:center;font-size:32px;font-weight:700;letter-spacing:-.5px;margin-bottom:48px}

.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
@media(max-width:900px){.grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:600px){.grid{grid-template-columns:1fr}.hero h2{font-size:36px}.hero p{font-size:16px}.hero-actions{flex-direction:column;align-items:center}}

.card{position:relative;background:var(--bg-card);border:1px solid var(--border);border-radius:16px;padding:28px;text-decoration:none;color:inherit;transition:all .4s cubic-bezier(.4,0,.2,1);overflow:hidden}
.card::before{content:'';position:absolute;inset:0;border-radius:16px;padding:1px;background:linear-gradient(135deg,transparent,transparent);-webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);-webkit-mask-composite:xor;mask-composite:exclude;opacity:0;transition:opacity .4s}
.card:hover{border-color:transparent;transform:translateY(-4px);box-shadow:0 20px 40px rgba(0,0,0,.3)}
.card:hover::before{opacity:1;background:linear-gradient(135deg,var(--accent),var(--purple))}
.card-glow{position:absolute;top:-50%;left:-50%;width:200%;height:200%;opacity:0;transition:opacity .4s;pointer-events:none}

.card:nth-child(1) .card-glow{background:radial-gradient(circle,var(--accent-glow),transparent 70%)}
.card:nth-child(2) .card-glow{background:radial-gradient(circle,var(--purple-glow),transparent 70%)}
.card:nth-child(3) .card-glow{background:radial-gradient(circle,var(--pink-glow),transparent 70%)}
.card:nth-child(4) .card-glow{background:radial-gradient(circle,var(--cyan-glow),transparent 70%)}
.card:nth-child(5) .card-glow{background:radial-gradient(circle,var(--green-glow),transparent 70%)}
.card:nth-child(6) .card-glow{background:radial-gradient(circle,var(--orange-glow),transparent 70%)}
.card:hover .card-glow{opacity:1}

.card-icon{width:52px;height:52px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:26px;margin-bottom:18px;position:relative;transition:transform .3s}
.card:hover .card-icon{transform:scale(1.1) rotate(-3deg)}
.card:nth-child(1) .card-icon{background:linear-gradient(135deg,rgba(99,102,241,.15),rgba(99,102,241,.05))}
.card:nth-child(2) .card-icon{background:linear-gradient(135deg,rgba(168,85,247,.15),rgba(168,85,247,.05))}
.card:nth-child(3) .card-icon{background:linear-gradient(135deg,rgba(236,72,153,.15),rgba(236,72,153,.05))}
.card:nth-child(4) .card-icon{background:linear-gradient(135deg,rgba(6,182,212,.15),rgba(6,182,212,.05))}
.card:nth-child(5) .card-icon{background:linear-gradient(135deg,rgba(34,197,94,.15),rgba(34,197,94,.05))}
.card:nth-child(6) .card-icon{background:linear-gradient(135deg,rgba(249,115,22,.15),rgba(249,115,22,.05))}

.card h3{font-size:17px;font-weight:600;margin-bottom:8px;position:relative}
.card p{font-size:13px;color:var(--text-secondary);line-height:1.6;position:relative}
.badge{display:inline-flex;align-items:center;gap:5px;font-size:11px;padding:4px 10px;border-radius:6px;font-weight:500;margin-top:12px;position:relative}
.badge-green{background:var(--green-glow);color:var(--green);border:1px solid rgba(34,197,94,.2)}
.badge-purple{background:var(--purple-glow);color:var(--purple);border:1px solid rgba(168,85,247,.2)}
.badge-cyan{background:var(--cyan-glow);color:var(--cyan);border:1px solid rgba(6,182,212,.2)}
.badge-orange{background:var(--orange-glow);color:var(--orange);border:1px solid rgba(249,115,22,.2)}

/* Stats Bar */
.stats{display:flex;justify-content:center;gap:48px;padding:40px 32px;border-top:1px solid var(--border);border-bottom:1px solid var(--border);margin:0 32px;background:rgba(24,24,27,.3);backdrop-filter:blur(10px)}
.stat{text-align:center}
.stat-value{font-size:28px;font-weight:700;background:linear-gradient(135deg,var(--accent-light),var(--purple));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.stat-label{font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-top:4px}

/* Footer */
.footer{text-align:center;padding:40px 32px;color:var(--text-muted);font-size:13px;border-top:1px solid var(--border)}
.footer a{color:var(--accent-light);text-decoration:none;transition:color .2s}
.footer a:hover{color:var(--purple)}
.footer-links{display:flex;justify-content:center;gap:24px;margin-bottom:20px}
.footer-links a{display:flex;align-items:center;gap:6px}
.footer-links a:hover{color:var(--text-primary)}
.footer-dev{display:flex;align-items:center;justify-content:center;gap:14px;margin-bottom:24px;padding:16px 28px;background:linear-gradient(135deg,rgba(99,102,241,.06),rgba(168,85,247,.06));border:1px solid rgba(99,102,241,.12);border-radius:14px}
.dev-avatar{width:44px;height:44px;background:linear-gradient(135deg,var(--accent),var(--purple));border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#fff;box-shadow:0 0 20px var(--accent-glow)}
.dev-info{display:flex;flex-direction:column;align-items:flex-start;gap:2px}
.dev-name{font-size:15px;font-weight:600;color:var(--text-primary);letter-spacing:-.3px}
.dev-role{font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px}

/* Floating particles */
.particles{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}
.particle{position:absolute;width:4px;height:4px;background:var(--accent);border-radius:50%;opacity:.3;animation:particleFloat linear infinite}
@keyframes particleFloat{
  0%{transform:translateY(100vh) scale(0);opacity:0}
  10%{opacity:.3}
  90%{opacity:.3}
  100%{transform:translateY(-10vh) scale(1);opacity:0}
}

/* Scroll animations */
.reveal{opacity:0;transform:translateY(30px);transition:all .6s cubic-bezier(.4,0,.2,1)}
.reveal.visible{opacity:1;transform:translateY(0)}
.reveal:nth-child(1){transition-delay:.0s}
.reveal:nth-child(2){transition-delay:.1s}
.reveal:nth-child(3){transition-delay:.2s}
.reveal:nth-child(4){transition-delay:.3s}
.reveal:nth-child(5){transition-delay:.4s}
.reveal:nth-child(6){transition-delay:.5s}
</style>
</head>
<body>
<div class="bg-grid"></div>
<div class="bg-glow bg-glow-1"></div>
<div class="bg-glow bg-glow-2"></div>
<div class="bg-glow bg-glow-3"></div>
<div class="particles" id="particles"></div>

<div class="content">
  <header class="header">
    <div class="header-left">
      <div class="logo">&#x1f3ac;</div>
      <h1><span>Persona</span> Studio</h1>
    </div>
    <div class="status-pill">
      <div class="status-dot" id="statusDot"></div>
      <span id="statusText">Connecting...</span>
    </div>
  </header>

  <section class="hero">
    <div class="hero-badge"><span>&#x2728;</span> Real-time Identity Transformation</div>
    <h2>Your Face. <span class="gradient">Your Rules.</span><br>Instantly.</h2>
    <p>Transform your identity in real-time with AI-powered face swap, voice cloning, live portrait animation, and more &mdash; built for video calls, content creation, and privacy.</p>
    <div class="hero-actions">
      <a href="/cam" class="btn btn-primary"><span class="btn-icon">&#x1f3a5;</span> Start Live Swap</a>
      <a href="/ui/" class="btn btn-secondary"><span class="btn-icon">&#x1f3a8;</span> Open Studio</a>
    </div>
  </section>

  <div class="stats">
    <div class="stat"><div class="stat-value" id="statCameras">-</div><div class="stat-label">Cameras</div></div>
    <div class="stat"><div class="stat-value" id="statFeatures">-</div><div class="stat-label">Features</div></div>
    <div class="stat"><div class="stat-value" id="statGPU">CPU</div><div class="stat-label">Device</div></div>
    <div class="stat"><div class="stat-value">v0.1</div><div class="stat-label">Version</div></div>
  </div>

  <section class="features">
    <div class="section-label">Capabilities</div>
    <div class="section-title">Everything you need to transform</div>
    <div class="grid">
      <a href="/cam" class="card reveal">
        <div class="card-glow"></div>
        <div class="card-icon">&#x1f4f7;</div>
        <h3>Live Face Swap</h3>
        <p>Real-time face swap with your webcam &mdash; share the browser tab in any video call for instant transformation.</p>
        <div class="badge badge-green">&#x25cf; Works with screen share</div>
      </a>
      <a href="/ui/" class="card reveal">
        <div class="card-glow"></div>
        <div class="card-icon">&#x1f3ad;</div>
        <h3>Live Portrait</h3>
        <p>Animate static portrait photos with expressions, head movements, and driving videos.</p>
        <div class="badge badge-purple">&#x2601; AI-Powered</div>
      </a>
      <a href="/ui/" class="card reveal">
        <div class="card-glow"></div>
        <div class="card-icon">&#x1f5bc;</div>
        <h3>Background Control</h3>
        <p>Remove, replace, or blur backgrounds with a single click. Perfect for professional video calls.</p>
        <div class="badge badge-cyan">&#x2714; Auto-detect</div>
      </a>
      <a href="/ui/" class="card reveal">
        <div class="card-glow"></div>
        <div class="card-icon">&#x1f399;</div>
        <h3>Voice Clone</h3>
        <p>Clone any voice from audio samples or convert your voice in real-time for complete identity masking.</p>
        <div class="badge badge-orange">&#x26A1; Real-time</div>
      </a>
      <a href="/ui/" class="card reveal">
        <div class="card-glow"></div>
        <div class="card-icon">&#x1f30a;</div>
        <h3>Image Filters</h3>
        <p>Apply professional filters and effects to your images and video feed for the perfect look.</p>
        <div class="badge badge-purple">&#x2728; 20+ filters</div>
      </a>
      <a href="/ui/" class="card reveal">
        <div class="card-glow"></div>
        <div class="card-icon">&#x1f310;</div>
        <h3>AI Translation</h3>
        <p>Translate audio between languages in real-time while preserving your voice characteristics.</p>
        <div class="badge badge-cyan">&#x1F30D; Multi-language</div>
      </a>
    </div>
  </section>

  <footer class="footer">
    <div class="footer-dev">
      <div class="dev-avatar">T</div>
      <div class="dev-info">
        <span class="dev-name">Timmydon</span>
        <span class="dev-role">Lead Developer &amp; Architect</span>
      </div>
    </div>
    <div class="footer-links">
      <a href="/docs"><span>&#x1f4e1;</span> API Docs</a>
      <a href="/ui/"><span>&#x2699;</span> Studio</a>
      <a href="https://github.com" target="_blank"><span>&#x1f4bb;</span> GitHub</a>
    </div>
    <p>Persona Studio v0.1.0 &mdash; Built with FastAPI, PyTorch &amp; InsightFace</p>
  </footer>
</div>

<script>
// Floating particles
(function(){
  const c=document.getElementById('particles');
  for(let i=0;i<30;i++){
    const p=document.createElement('div');
    p.className='particle';
    p.style.left=Math.random()*100+'%';
    p.style.animationDuration=(8+Math.random()*12)+'s';
    p.style.animationDelay=Math.random()*10+'s';
    p.style.width=p.style.height=(2+Math.random()*4)+'px';
    const colors=['#6366f1','#a855f7','#06b6d4','#22c55e','#ec4899'];
    p.style.background=colors[Math.floor(Math.random()*colors.length)];
    c.appendChild(p);
  }
})();

// Scroll reveal
const obs=new IntersectionObserver((entries)=>{
  entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');obs.unobserve(e.target)}});
},{threshold:.1});
document.querySelectorAll('.reveal').forEach(el=>obs.observe(el));

// Status check
fetch('/health').then(r=>r.json()).then(d=>{
  document.getElementById('statusDot').style.background='#22c55e';
  document.getElementById('statusText').textContent='Online';
  document.getElementById('statGPU').textContent=d.device||'CPU';
}).catch(()=>{
  document.getElementById('statusDot').style.background='#ef4444';
  document.getElementById('statusText').textContent='Offline';
});

// Cameras count
fetch('/cameras').then(r=>r.json()).then(d=>{
  document.getElementById('statCameras').textContent=(d.cameras||[]).length;
}).catch(()=>{document.getElementById('statCameras').textContent='0'});

// Features count
fetch('/features').then(r=>r.json()).then(d=>{
  const count=Object.values(d.features||{}).filter(v=>v).length;
  document.getElementById('statFeatures').textContent=count;
}).catch(()=>{document.getElementById('statFeatures').textContent='-'});
</script>
</body>
</html>
"""

WEBPAGE_CAM = """\
<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<title>Persona Studio</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{width:100%;height:100%;overflow:hidden;font-family:system-ui,-apple-system,sans-serif;background:#000;color:#fff;touch-action:none;-webkit-user-select:none;user-select:none}
#app{width:100%;height:100%;display:flex;flex-direction:column;position:relative}
.video-wrap{flex:1;position:relative;background:#0a0a0a;overflow:hidden;display:flex;align-items:center;justify-content:center;min-height:0}
#sourceVideo{display:none}
#resultCanvas{width:100%;height:100%;object-fit:contain;display:block}
.overlay{position:absolute;top:env(safe-area-inset-top,8px);left:8px;right:8px;display:flex;justify-content:space-between;pointer-events:none;z-index:10;gap:4px}
.status-badge{padding:4px 10px;border-radius:16px;font-size:11px;font-weight:600;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);text-shadow:0 1px 4px rgba(0,0,0,.5)}
.status-ok{background:#05966960;color:#6ee7b7;border:1px solid #05966980}
.status-warn{background:#d9770660;color:#fde68a;border:1px solid #d9770680}
.status-err{background:#dc262660;color:#fca5a5;border:1px solid #dc262680}

.controls{background:linear-gradient(0deg,#1a1a24 0%,rgba(26,26,36,.85) 100%);border-top:1px solid #2a2a35;padding:calc(8px + env(safe-area-inset-bottom,0px)) 8px 8px;display:flex;flex-direction:column;gap:6px;position:relative;z-index:20}
.ctrl-row{display:flex;gap:6px;align-items:center;justify-content:center;flex-wrap:wrap}
.ctrl-row button,.ctrl-row label{min-height:40px}
.btn{display:inline-flex;align-items:center;justify-content:center;padding:8px 16px;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;flex-shrink:0;gap:4px;touch-action:manipulation}
.btn:active{transform:scale(.95)}
.btn-primary{background:#4f46e5;color:#fff}
.btn-primary:active{background:#4338ca}
.btn-danger{background:#dc2626;color:#fff}
.btn-danger:active{background:#b91c1c}
.btn-ghost{background:rgba(255,255,255,.08);color:#e4e4e7;border:1px solid rgba(255,255,255,.1)}
.btn-ghost:active{background:rgba(255,255,255,.15)}
.btn-icon{padding:8px;min-width:40px;font-size:16px}
.btn-sm{padding:6px 12px;font-size:12px}
.btn-active{background:#4f46e5;color:#fff;border-color:#4f46e5}
.ctrl-select{background:rgba(255,255,255,.08);color:#e4e4e7;border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:8px 28px 8px 12px;font-size:13px;appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%23a1a1aa' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 8px center;min-width:0;flex:1;max-width:160px}
#sourceInput{display:none}
.file-label{padding:8px 14px;background:rgba(255,255,255,.08);border-radius:10px;font-size:12px;color:#a1a1aa;cursor:pointer;border:1px dashed rgba(255,255,255,.15);flex-shrink:0;text-align:center;min-width:60px;touch-action:manipulation}
.file-label:active{background:rgba(255,255,255,.15)}
.mode-group{display:flex;gap:3px;background:rgba(255,255,255,.06);border-radius:10px;padding:3px}
.mode-btn{padding:6px 14px;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;background:transparent;color:#a1a1aa;touch-action:manipulation}
.mode-btn.active{background:#4f46e5;color:#fff}
.mode-btn:active{opacity:.7}
.hint{text-align:center;font-size:10px;color:#52525b;padding:4px 8px;line-height:1.3}

#pairPanel{display:none;position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.85);z-index:100;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);align-items:center;justify-content:center;flex-direction:column;gap:16px;padding:24px}
#pairPanel.show{display:flex}
#pairPanel h2{font-size:18px;font-weight:600;color:#e4e4e7}
#pairPanel p{font-size:13px;color:#a1a1aa;text-align:center;max-width:320px;line-height:1.5}
#qrCanvas{background:#fff;border-radius:12px;padding:12px;width:200px;height:200px}
#pairUrl{font-size:11px;color:#818cf8;word-break:break-all;text-align:center;max-width:300px}
.pair-close{position:absolute;top:env(safe-area-inset-top,12px);right:12px;background:rgba(255,255,255,.1);border:none;color:#fff;width:36px;height:36px;border-radius:50%;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center}

@media(min-width:768px){
.controls{padding:10px 16px calc(10px + env(safe-area-inset-bottom,0px))}
.ctrl-row{gap:8px}
.btn{padding:10px 20px;font-size:14px}
.ctrl-select{font-size:14px;padding:10px 32px 10px 14px}
.mode-btn{padding:8px 18px;font-size:13px}
}
</style></head><body>
<div id="app">
<div class="video-wrap">
<video id="sourceVideo" autoplay playsinline muted></video>
<canvas id="resultCanvas"></canvas>
<div class="overlay">
<span id="statusBadge" class="status-badge status-warn">Starting\u2026</span>
<span id="fpsBadge" class="status-badge status-warn">0 FPS</span>
</div>
</div>
<div class="controls">
<div class="ctrl-row">
<button id="startBtn" class="btn btn-primary" style="flex:1">\u25b6 Start</button>
<button id="stopBtn" class="btn btn-danger" style="display:none;flex:1">\u25a0 Stop</button>
<button id="flipBtn" class="btn btn-ghost btn-icon" title="Flip camera">\u21bb</button>
<button id="pairBtn" class="btn btn-ghost btn-sm">📱 Pair</button>
</div>
<div class="ctrl-row" style="justify-content:space-between">
<div class="mode-group">
<button id="modeLive" class="mode-btn active">Live</button>
<button id="modePhoto" class="mode-btn">Photo</button>
</div>
<label for="sourceInput" class="file-label" id="fileLabel">+ Face</label>
<input type="file" id="sourceInput" accept="image/*">
<button id="mirrorToggle" class="btn btn-ghost btn-icon" title="Mirror">\u2194</button>
<select id="cameraSelect" class="ctrl-select"><option value="user">Front</option><option value="environment">Rear</option></select>
</div>
<div class="ctrl-row" style="justify-content:center;gap:4px;padding:4px 0">
<button id="trackingToggle" class="btn btn-ghost btn-sm btn-active" title="Enable tracking">🎯 Track</button>
<button id="expressionToggle" class="btn btn-ghost btn-sm btn-active" title="Expression transfer">😊 Expr</button>
<button id="headPoseToggle" class="btn btn-ghost btn-sm btn-active" title="Head pose transfer">🗣 Head</button>
<button id="handToggle" class="btn btn-ghost btn-sm btn-active" title="Hand overlay">✋ Hands</button>
</div>
<div id="trackingInfo" class="hint" style="display:none;color:#818cf8">Tracking active</div>
<div id="pairHint" class="hint">Open this page on your phone for remote camera &bull; Share screen in video calls</div>
</div>
</div>

<div id="pairPanel">
<button class="pair-close" id="pairClose">&times;</button>
<h2>📱 Phone as Camera</h2>
<p>Open this URL on your phone to use its camera as a remote source for this laptop:</p>
<div style="background:rgba(255,255,255,.06);border-radius:12px;padding:12px 20px;margin:8px 0;text-align:center">
<code id="pairUrl" style="font-size:15px;color:#818cf8;word-break:break-all;user-select:all">loading...</code>
</div>
<button id="copyBtn" class="btn btn-primary" style="font-size:14px;padding:10px 32px">📋 Copy URL</button>
<p style="font-size:11px;color:#52525b;margin-top:4px">Open the URL on your phone's browser. The camera feed will stream here.</p>
</div>

<script>
const WS_URL=(location.protocol==='https:'?'wss:':'ws:')+'//'+location.host+'/stream';
const API_BASE='';
let ws=null,ctx=null,stream=null,animFrame=null,sourceFaceId=null;
let mirror=true,mode='live',lastTime=0,fps=0,frameCount=0,facing='user';
let _sendCanvas=null;

const $=id=>document.getElementById(id);
const srcVideo=$('sourceVideo');
const resultCanvas=$('resultCanvas');
const statusBadge=$('statusBadge');
const fpsBadge=$('fpsBadge');
const startBtn=$('startBtn');
const stopBtn=$('stopBtn');
const flipBtn=$('flipBtn');
const pairBtn=$('pairBtn');
const pairPanel=$('pairPanel');
const pairClose=$('pairClose');
const pairUrl=$('pairUrl');
const sourceInput=$('sourceInput');
const fileLabel=$('fileLabel');
const trackingToggle=$('trackingToggle');
const expressionToggle=$('expressionToggle');
const headPoseToggle=$('headPoseToggle');
const handToggle=$('handToggle');
const trackingInfo=$('trackingInfo');

let trackingEnabled=true, expressionTransfer=true, headPoseTransfer=true, handOverlay=true;

function setStatus(text,type){statusBadge.textContent=text;statusBadge.className='status-badge status-'+type}
function setFps(val){fpsBadge.textContent=val+' FPS';fpsBadge.className='status-badge '+(val>20?'status-ok':val>0?'status-warn':'status-warn')}

async function toggleTracking(type,enabled){
 try{
  const endpoint=type==='tracking'?'/tracking':`/tracking/${type}`;
  await fetch(API_BASE+endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'enabled='+enabled});
 }catch(e){console.error('Tracking toggle failed:',e)}
}

function updateTrackingDisplay(){
 const info=[];
 if(trackingEnabled)info.push('🎯');
 if(expressionTransfer)info.push('😊');
 if(headPoseTransfer)info.push('🗣');
 if(handOverlay)info.push('✋');
 trackingInfo.style.display=info.length>0&&stream?'block':'none';
 trackingInfo.textContent='Tracking: '+info.join(' ');
}

function connectWs(){
 if(ws)try{ws.close()}catch(e){}
 ws=new WebSocket(WS_URL);
 ws.onopen=()=>{setStatus('Connected','ok');updateTrackingDisplay()};
 ws.onmessage=ev=>{
  if(typeof ev.data==='string'){
   try{
    const msg=JSON.parse(ev.data);
    if(msg.tracking){
     const t=msg.tracking;
     let info='';
     if(t.head_pose)info+=`Pitch:${t.head_pose.pitch.toFixed(1)}° Yaw:${t.head_pose.yaw.toFixed(1)}° `;
     if(t.expression){
      if(t.expression.mouth_open>0.3)info+=' Mouth:Open ';
      if(t.expression.mouth_smile>0.3)info+=' Smile ';
     }
     if(t.left_hand&&t.left_hand.detected)info+=` Left:${t.left_hand.gesture} `;
     if(t.right_hand&&t.right_hand.detected)info+=` Right:${t.right_hand.gesture} `;
     if(info)trackingInfo.textContent='Tracking: '+info.trim();
    }
   }catch(e){}
   return;
  }
  const url=URL.createObjectURL(ev.data);
  const img=new Image();
  img.onload=()=>{
   ctx=resultCanvas.getContext('2d');
   resultCanvas.width=img.width;
   resultCanvas.height=img.height;
   ctx=resultCanvas.getContext('2d');
   if(mirror){ctx.save();ctx.translate(img.width,0);ctx.scale(-1,1);ctx.drawImage(img,0,0);ctx.restore()}
   else ctx.drawImage(img,0,0);
   URL.revokeObjectURL(url);
   frameCount++;
  };
  img.src=url;
 };
 ws.onerror=()=>setStatus('Disconnected','err');
 ws.onclose=()=>{setStatus('Disconnected','err');ws=null;trackingInfo.style.display='none'};
}

function sendFrame(video){
 if(!ws||ws.readyState!==1||!video.videoWidth)return;
 if(!_sendCanvas)_sendCanvas=document.createElement('canvas');
 const maxW=1280,maxH=720;
 const scale=Math.min(maxW/video.videoWidth,maxH/video.videoHeight,1);
 _sendCanvas.width=Math.round(video.videoWidth*scale);
 _sendCanvas.height=Math.round(video.videoHeight*scale);
 _sendCanvas.getContext('2d').drawImage(video,0,0,_sendCanvas.width,_sendCanvas.height);
 _sendCanvas.toBlob(blob=>{if(ws&&ws.readyState===1)ws.send(blob)},'image/jpeg',0.92);
}

async function getCam(){return await navigator.mediaDevices.getUserMedia({video:{facingMode:facing,width:{ideal:1280},height:{ideal:720}},audio:false})}

async function startCamera(){
 try{
  stream=await getCam();
  srcVideo.srcObject=stream;
  await srcVideo.play();
  connectWs();
  setStatus('Running','ok');
  startBtn.style.display='none';
  stopBtn.style.display='';
  let last=performance.now();
  function loop(now){
   if(!srcVideo.srcObject)return;
   sendFrame(srcVideo);
   const dt=now-last;
   if(dt>=1000){setFps(frameCount);frameCount=0;last=now}
   animFrame=requestAnimationFrame(loop);
  }
  animFrame=requestAnimationFrame(loop);
 }catch(e){setStatus('Camera: '+e.message,'err')}
}

function stopCamera(){
 if(animFrame){cancelAnimationFrame(animFrame);animFrame=null}
 if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}
 srcVideo.srcObject=null;
 if(ws){try{ws.close()}catch(e){}ws=null}
 ctx=null;
 resultCanvas.getContext('2d').clearRect(0,0,resultCanvas.width,resultCanvas.height);
 resultCanvas.width=0;resultCanvas.height=0;
 setStatus('Stopped','warn');
 startBtn.style.display='';
 stopBtn.style.display='none';
}

async function uploadSourceFace(file){
 const form=new FormData();form.append('file',file);
 try{
  const {file_id}=await(await fetch(API_BASE+'/upload',{method:'POST',body:form})).json();
  sourceFaceId=file_id;
  await fetch(API_BASE+'/set-source',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'file_id='+encodeURIComponent(file_id)});
  fileLabel.textContent='\u2713 '+file.name;
  fileLabel.style.borderColor='#34d399';
  setStatus('Source loaded','ok');
  if(mode==='photo'){await uploadTargetAndSwap()}
 }catch(e){fileLabel.textContent='Failed';setStatus('Upload error','err')}
}

async function uploadAndSwap(imgData){
 if(!sourceFaceId)return;
 try{
  const blob=await new Promise(r=>imgData.toBlob(r,'image/png'));
  const form=new FormData();form.append('file',new File([blob],'selfie.png'));
  const {file_id}=await(await fetch(API_BASE+'/upload',{method:'POST',body:form})).json();
  const {output_url}=await(await fetch(API_BASE+'/swap',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({source_id:sourceFaceId,target_id:file_id,no_watermark:true})})).json();
  if(output_url){
   const img=new Image();
   img.onload=()=>{
    resultCanvas.width=img.width;resultCanvas.height=img.height;
    ctx=resultCanvas.getContext('2d');
    if(mirror){ctx.save();ctx.translate(img.width,0);ctx.scale(-1,1);ctx.drawImage(img,0,0);ctx.restore()}
    else ctx.drawImage(img,0,0);
   };img.src=API_BASE+output_url;
  }
 }catch(e){console.error(e)}
}

startBtn.addEventListener('click',startCamera);
stopBtn.addEventListener('click',stopCamera);

flipBtn.addEventListener('click',()=>{
 facing=facing==='user'?'environment':'user';
 if(stream){stopCamera();setTimeout(startCamera,200)}
});

mirrorToggle.addEventListener('click',()=>{mirror=!mirror;mirrorToggle.classList.toggle('btn-active')});

$('modeLive').addEventListener('click',()=>{
 mode='live';
 $('modeLive').classList.add('active');$('modePhoto').classList.remove('active');
 setStatus('Live mode','ok');
});

$('modePhoto').addEventListener('click',()=>{
 mode='photo';
 $('modePhoto').classList.add('active');$('modeLive').classList.remove('active');
 if(sourceFaceId){
  const c=document.createElement('canvas');
  c.width=srcVideo.videoWidth||1280;c.height=srcVideo.videoHeight||720;
  c.getContext('2d').drawImage(srcVideo,0,0);
  uploadAndSwap(c);
 }
 setStatus('Photo mode','warn');
});

sourceInput.addEventListener('change',e=>{if(e.target.files[0])uploadSourceFace(e.target.files[0])});

$('cameraSelect').addEventListener('change',e=>{
 facing=e.target.value;
 if(stream){stopCamera();setTimeout(startCamera,200)}
});

navigator.mediaDevices.enumerateDevices().then(devs=>{
 const sel=$('cameraSelect');
 devs.filter(d=>d.kind==='videoinput').forEach((d,i)=>{
  if(d.label.toLowerCase().includes('back')||d.label.toLowerCase().includes('rear')||d.label.toLowerCase().includes('environment'))return;
  if(d.label.toLowerCase().includes('front')||d.label.toLowerCase().includes('face'))return;
  const opt=document.createElement('option');
  opt.value=d.deviceId;opt.text=d.label||'Cam '+(i+1);
  sel.appendChild(opt);
 });
}).catch(()=>{});

pairBtn.addEventListener('click',()=>{
 const url=location.origin;
 $('pairUrl').textContent=url;
 pairPanel.classList.add('show');
});
$('copyBtn').addEventListener('click',()=>{
 const url=$('pairUrl').textContent;
 navigator.clipboard.writeText(url).then(()=>{
  $('copyBtn').textContent='✅ Copied!';
  setTimeout(()=>{$('copyBtn').textContent='📋 Copy URL'},2000);
 }).catch(()=>{
  const ta=document.createElement('textarea');ta.value=url;ta.style.position='fixed';ta.style.opacity='0';
  document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);
  $('copyBtn').textContent='✅ Copied!';
  setTimeout(()=>{$('copyBtn').textContent='📋 Copy URL'},2000);
 });
});
pairClose.addEventListener('click',()=>pairPanel.classList.remove('show'));
pairPanel.addEventListener('click',e=>{if(e.target===pairPanel)pairPanel.classList.remove('show')});

trackingToggle.addEventListener('click',()=>{
 trackingEnabled=!trackingEnabled;
 trackingToggle.classList.toggle('btn-active',trackingEnabled);
 toggleTracking('tracking',trackingEnabled);
 updateTrackingDisplay();
});

expressionToggle.addEventListener('click',()=>{
 expressionTransfer=!expressionTransfer;
 expressionToggle.classList.toggle('btn-active',expressionTransfer);
 toggleTracking('expression-transfer',expressionTransfer);
 updateTrackingDisplay();
});

headPoseToggle.addEventListener('click',()=>{
 headPoseTransfer=!headPoseTransfer;
 headPoseToggle.classList.toggle('btn-active',headPoseTransfer);
 toggleTracking('head-pose-transfer',headPoseTransfer);
 updateTrackingDisplay();
});

handToggle.addEventListener('click',()=>{
 handOverlay=!handOverlay;
 handToggle.classList.toggle('btn-active',handOverlay);
 toggleTracking('hand-overlay',handOverlay);
 updateTrackingDisplay();
});

setStatus('Tap Start','warn');
</script>
</body></html>
"""

WEBPAGE_PHONE_CAM = """\
<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<title>Persona Phone Cam</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:#000;color:#fff;font-family:system-ui,-apple-system,sans-serif;touch-action:none;-webkit-user-select:none;user-select:none}
#app{width:100%;height:100%;display:flex;flex-direction:column;position:relative}
.video-wrap{flex:1;display:flex;align-items:center;justify-content:center;background:#0a0a0a;position:relative;overflow:hidden;min-height:0}
video{width:100%;height:100%;object-fit:cover;transform:scaleX(-1)}
canvas{display:none}
.status-bar{position:absolute;top:env(safe-area-inset-top,8px);left:8px;right:8px;display:flex;justify-content:space-between;pointer-events:none;z-index:10}
.badge{padding:4px 10px;border-radius:16px;font-size:10px;font-weight:600;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);text-shadow:0 1px 4px rgba(0,0,0,.5)}
.badge-ok{background:#05966960;color:#6ee7b7;border:1px solid #05966980}
.badge-warn{background:#d9770660;color:#fde68a;border:1px solid #d9770680}
.badge-err{background:#dc262660;color:#fca5a5;border:1px solid #dc262680}
.bar{position:absolute;bottom:env(safe-area-inset-bottom,16px);left:0;right:0;display:flex;justify-content:center;gap:20px;pointer-events:none;z-index:10;padding:0 16px}
.bar button{pointer-events:auto;width:56px;height:56px;border-radius:50%;border:none;font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
.flip-btn{background:rgba(255,255,255,.2);color:#fff}
.flip-btn:active{transform:scale(.9);background:rgba(255,255,255,.3)}
.record-btn{background:#dc2626;color:#fff;box-shadow:0 0 20px rgba(220,38,38,.4)}
.record-btn.active{background:#059669;box-shadow:0 0 20px rgba(5,150,105,.4)}
.record-btn:active{transform:scale(.9)}
.info{position:absolute;bottom:90px;left:16px;right:16px;text-align:center;font-size:11px;color:#a1a1aa;pointer-events:none;z-index:10;text-shadow:0 1px 4px rgba(0,0,0,.8);line-height:1.4}
</style></head><body>
<div id="app">
<div class="video-wrap">
<video id="cam" autoplay playsinline muted></video>
<canvas id="sendCanvas"></canvas>
<div class="status-bar">
<span id="statusBadge" class="badge badge-warn">Connecting\u2026</span>
<span id="fpsBadge" class="badge badge-warn">0 FPS</span>
</div>
<div class="info" id="infoText">Sending camera to Persona server\u2026</div>
<div class="bar">
<button class="flip-btn" id="flipBtn">\u21bb</button>
<button class="record-btn" id="recordBtn">\u25cf</button>
</div>
</div>
<script>
const WS_URL=(location.protocol==='https:'?'wss:':'ws:')+'//'+location.host+'/stream';
const API_BASE='';
let ws=null,stream=null,animFrame=null,facing='environment',sending=true;
const video=document.getElementById('cam');
const sendCanvas=document.getElementById('sendCanvas');
const statusBadge=document.getElementById('statusBadge');
const fpsBadge=document.getElementById('fpsBadge');
const infoText=document.getElementById('infoText');
const flipBtn=document.getElementById('flipBtn');
const recordBtn=document.getElementById('recordBtn');

function setStatus(text,type){statusBadge.textContent=text;statusBadge.className='badge badge-'+type}
function setFps(val){fpsBadge.textContent=val+' FPS';fpsBadge.className='badge '+(val>20?'badge-ok':'badge-warn')}

function connectWs(){
 if(ws)try{ws.close()}catch(e){}
 ws=new WebSocket(WS_URL);
 ws.onopen=()=>{setStatus('Connected','ok');infoText.textContent='Sending camera feed to server\u2026'};
 ws.onerror=()=>{setStatus('Disconnected','err');infoText.textContent='Server not reachable. Is the server running?'};
 ws.onclose=()=>{setStatus('Disconnected','err');ws=null;setTimeout(connectWs,2000)};
}

function sendFrame(){
 if(!ws||ws.readyState!==1||!video.videoWidth||!sending)return;
 const ps=Math.min(1280/video.videoWidth,720/video.videoHeight,1);
 sendCanvas.width=Math.round(video.videoWidth*ps);
 sendCanvas.height=Math.round(video.videoHeight*ps);
 sendCanvas.getContext('2d').drawImage(video,0,0,sendCanvas.width,sendCanvas.height);
 sendCanvas.toBlob(blob=>{if(ws&&ws.readyState===1)ws.send(blob)},'image/jpeg',0.92);
}

async function startCam(){
 try{
  stream=await navigator.mediaDevices.getUserMedia({
   video:{facingMode:facing,width:{ideal:1280},height:{ideal:720}},
   audio:false
  });
  video.srcObject=stream;await video.play();
  connectWs();
  setStatus('Running','ok');
  infoText.textContent='Camera active. Point at subject.';
  let last=performance.now(),fc=0;
  function loop(now){
   sendFrame();
   fc++;const dt=now-last;
   if(dt>=1000){setFps(fc);fc=0;last=now}
   animFrame=requestAnimationFrame(loop);
  }
  animFrame=requestAnimationFrame(loop);
 }catch(e){setStatus('Error','err');infoText.textContent='Camera error: '+e.message}
}

function stopCam(){
 if(animFrame){cancelAnimationFrame(animFrame);animFrame=null}
 if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}
 video.srcObject=null;
 if(ws){try{ws.close()}catch(e){}}
 setStatus('Stopped','warn');infoText.textContent='Camera stopped';
}

flipBtn.addEventListener('click',()=>{
 facing=facing==='user'?'environment':'user';
 stopCam();setTimeout(startCam,300);
});

recordBtn.addEventListener('click',()=>{
 sending=!sending;
 recordBtn.classList.toggle('active');
 recordBtn.textContent=sending?'\u25cf':'\u25a0';
 infoText.textContent=sending?'Sending camera feed\u2026':'Paused';
});

startCam();
window.addEventListener('beforeunload',stopCam);
</script>
</body></html>
"""


def _require_file(path: Path, label: str) -> None:
    if not path.is_file():
        raise HTTPException(status_code=404, detail=f"{label} not found")


def _check_write(ok: bool, path: Path) -> None:
    if not ok or not path.is_file() or path.stat().st_size == 0:
        raise MediaProcessingError(f"failed to write media output: {path.name}")


def _http_error(exc: Exception) -> HTTPException:
    if isinstance(exc, HTTPException):
        return exc
    if isinstance(exc, FeatureUnavailableError):
        return HTTPException(status_code=503, detail=str(exc))
    if isinstance(exc, MediaProcessingError):
        return HTTPException(status_code=500, detail=str(exc))
    if isinstance(exc, ValueError):
        return HTTPException(status_code=422, detail=str(exc))
    logger.exception("Unhandled media operation failure")
    return HTTPException(status_code=500, detail="media operation failed; see server logs")

def create_app() -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        try:
            yield
        finally:
            _engine_state.unload()

    app = FastAPI(title="Persona Studio", version="0.1.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS if CORS_ORIGINS != ["*"] else ["*"],
        allow_credentials=CORS_ORIGINS != ["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    frontend_dist = FRONTEND_DIST
    frontend_dev = FRONTEND_DEV
    frontend_index = frontend_dist / "index.html"

    if frontend_dist.exists() and frontend_index.exists():
        app.mount("/ui", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")
        assets_dir = frontend_dist / "assets"
        if assets_dir.is_dir():
            app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="frontend-assets")
    else:
        @app.get("/ui")
        async def ui_redirect():
            return HTMLResponse(
                '<html><head><meta http-equiv="refresh" content="0;url=/cam"></head>'
                "<body><a href='/cam'>Open Webcam Face Swap</a></body></html>"
            )

    @app.get("/")
    async def root():
        return HTMLResponse(WEBPAGE_INDEX)

    @app.get("/cam")
    async def webcam_page():
        return HTMLResponse(WEBPAGE_CAM)

    @app.get("/phone")
    async def phone_cam_page():
        return HTMLResponse(WEBPAGE_PHONE_CAM)

    @app.get("/health")
    async def health():
        try:
            engine = _engine_state.get_engine()
            return {"status": "ok", "version": "0.1.0", "engine": engine.status()}
        except Exception as exc:
            logger.exception("Health check failed")
            return {"status": "degraded", "version": "0.1.0", "error": str(exc)}

    @app.get("/features")
    async def features():
        engine = _engine_state.get_engine()
        status = engine.status()["features"]
        return {
            "face_swap": bool(status["face_swap"]["available"]),
            "video_face_swap": bool(status["face_swap"]["available"]),
            "live_portrait": bool(status["live_portrait"]["available"]),
            "voice_changer": bool(status["voice_convert"]["available"]),
            "voice_cloning": bool(status["voice_clone"]["available"]),
            "background_removal": bool(status["background"]["available"]),
            "background_replacement": bool(status["background"]["available"]),
            "filters": bool(status["filters"]["available"]),
            "virtual_camera": True,
            "magiclip_translate": _engine_state.translator_available(),
            "4k_hd": bool(status["face_swap"]["available"]),
            "advanced_tuning": True,
            "watermark": True,
            "multi_platform": True,
            "advanced_tracking": bool(status.get("advanced_tracking", {}).get("available", False)),
            "hand_tracking": bool(status.get("hand_tracking", {}).get("available", False)),
            "details": status,
        }

    @app.get("/cameras")
    async def list_cameras():
        cameras = detect_cameras()
        return {"cameras": cameras}

    @app.post("/virtual-cam/start")
    async def start_virtual_cam(req: VirtualCamRequest):
        try:
            from persona_swap_core.virtual_cam import VirtualCamera
            cam = VirtualCamera(name="Persona Camera", width=req.width, height=req.height, fps=req.fps)
            ok = cam.start()
            if not ok:
                raise HTTPException(status_code=503, detail="failed to start virtual camera; install a supported backend")
            _engine_state.stop_virtual_cam()
            _engine_state.start_virtual_cam(cam)
            return {"status": "ok", "device": req.device, "resolution": f"{req.width}x{req.height}", "fps": req.fps}
        except HTTPException:
            raise
        except Exception as exc:
            raise _http_error(exc)

    @app.post("/virtual-cam/stop")
    async def stop_virtual_cam():
        _engine_state.stop_virtual_cam()
        return {"status": "ok"}

    @app.get("/virtual-cam/status")
    async def virtual_cam_status():
        return _engine_state.get_virtual_cam_status()

    # ── Video Call Rooms ─────────────────────────────────────────────────

    @app.post("/rooms")
    async def create_room(
        name: str = Form(default=""),
        max_participants: int = Form(default=8),
    ):
        room = _room_manager.create_room(name=name or None, max_participants=max_participants)
        return {
            "room_id": room.room_id,
            "name": room.name,
            "max_participants": room.max_participants,
        }

    @app.get("/rooms")
    async def list_rooms():
        return {"rooms": _room_manager.list_rooms()}

    @app.get("/rooms/{room_id}")
    async def get_room(room_id: str):
        room = _room_manager.get_room(room_id)
        if not room:
            raise HTTPException(status_code=404, detail="Room not found")
        return {
            "room_id": room.room_id,
            "name": room.name,
            "participants": room.get_participant_list(),
            "max_participants": room.max_participants,
        }

    @app.delete("/rooms/{room_id}")
    async def delete_room(room_id: str):
        if not _room_manager.delete_room(room_id):
            raise HTTPException(status_code=404, detail="Room not found")
        return {"status": "deleted"}

    @app.websocket("/room/{room_id}/stream")
    async def room_stream(ws: WebSocket, room_id: str):
        """Multi-party video call WebSocket.

        Protocol:
        - First message (JSON): {"user_id": "...", "name": "..."}
        - Then binary messages: JPEG video frames (processed and forwarded to room)
        - JSON messages: {"type": "audio", "data": base64} for audio forwarding
        - JSON messages: {"type": "control", "muted": bool, "video_off": bool}
        - Server sends: binary JPEG frames from other participants
        - Server sends: JSON {"type": "participant_joined", ...} / {"type": "participant_left", ...}
        - Server sends: JSON {"tracking": ..., "from": "..."} for tracking data
        """
        await ws.accept()
        room = _room_manager.get_room(room_id)
        if not room:
            await ws.send_json({"error": "Room not found"})
            await ws.close(code=4004, reason="Room not found")
            return

        user_id = None
        try:
            # Wait for join message
            join_msg = await ws.receive_json()
            user_id = join_msg.get("user_id", uuid.uuid4().hex[:12])
            user_name = join_msg.get("name", f"User {user_id[:6]}")

            participant = RoomParticipant(user_id, user_name, ws)
            if not room.add_participant(participant):
                await ws.send_json({"error": "Room is full"})
                await ws.close(code=4003, reason="Room full")
                return

            # Notify others
            await room.broadcast_system(
                {"type": "participant_joined", "user_id": user_id, "name": user_name},
                exclude=user_id,
            )

            # Send current participant list to new user
            await ws.send_json({
                "type": "room_info",
                "room_id": room_id,
                "participants": room.get_participant_list(),
            })

            logger.info(f"User {user_name} ({user_id}) joined room {room_id}")

            engine = _engine_state.get_engine()
            min_frame_interval = 1.0 / 30.0

            while True:
                data = await ws.receive()
                now = time.monotonic()

                if "bytes" in data:
                    # Video frame from participant
                    frame_bytes = data["bytes"]
                    arr = np.frombuffer(frame_bytes, dtype=np.uint8)
                    try:
                        import cv2
                        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                        if img is not None:
                            from shared.types import VideoFrame
                            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

                            if engine.has_source():
                                tracking_result = engine.process_frame_with_tracking(img_rgb)
                                tracked_frame = tracking_result["frame"]
                                target_frame = VideoFrame(image=tracked_frame)
                                source_frame = VideoFrame(image=np.zeros_like(img_rgb))
                                result = engine.swap(source_frame, target_frame)
                                _engine_state.send_virtual_cam(result.image)
                                _, buf = cv2.imencode(".jpg", result.image)
                                await room.broadcast_frame(user_id, buf.tobytes(), tracking_result.get("tracking"))
                            else:
                                _, buf = cv2.imencode(".jpg", img_rgb)
                                await room.broadcast_frame(user_id, buf.tobytes())
                    except ImportError:
                        await ws.send_json({"error": "opencv unavailable"})
                    except Exception as e:
                        logger.exception("Frame processing failed in room")

                elif "text" in data:
                    try:
                        msg = json.loads(data["text"])
                        msg_type = msg.get("type", "")

                        if msg_type == "audio":
                            # Audio forwarding (base64 encoded)
                            import base64
                            audio_data = base64.b64decode(msg.get("data", ""))
                            if audio_data:
                                await room.broadcast_audio(user_id, audio_data)

                        elif msg_type == "control":
                            participant.muted = msg.get("muted", participant.muted)
                            participant.video_off = msg.get("video_off", participant.video_off)
                            await room.broadcast_system(
                                {"type": "participant_updated", "user_id": user_id, "muted": participant.muted, "video_off": participant.video_off},
                                exclude=user_id,
                            )

                        elif msg_type == "chat":
                            await room.broadcast_system(
                                {"type": "chat", "from": user_id, "name": user_name, "message": msg.get("message", "")},
                            )

                    except json.JSONDecodeError:
                        pass

                elapsed = time.monotonic() - now
                if elapsed < min_frame_interval:
                    await asyncio.sleep(min_frame_interval - elapsed)

        except WebSocketDisconnect:
            pass
        except Exception as exc:
            logger.exception(f"Room WebSocket error: {exc}")
        finally:
            if user_id:
                room.remove_participant(user_id)
                await room.broadcast_system(
                    {"type": "participant_left", "user_id": user_id},
                )
                logger.info(f"User {user_id} left room {room_id}")
                # Delete room if empty
                if not room.participants:
                    _room_manager.delete_room(room_id)
                    logger.info(f"Room {room_id} deleted (empty)")

    @app.post("/swap", response_model=SwapResponse)
    async def swap(req: SwapRequest) -> SwapResponse:
        source_path = _safe_storage_path(UPLOAD_DIR, req.source_id)
        target_path = _safe_storage_path(UPLOAD_DIR, req.target_id)

        if not source_path.is_file():
            raise HTTPException(status_code=404, detail=f"Source file not found: {req.source_id}")
        if not target_path.is_file():
            raise HTTPException(status_code=404, detail=f"Target file not found: {req.target_id}")

        try:
            _engine_state.get_engine().require_feature("face_swap")
            import cv2
            source_bgr = cv2.imread(str(source_path))
            target_bgr = cv2.imread(str(target_path))

            if source_bgr is None:
                raise HTTPException(status_code=400, detail="Cannot read source image")
            if target_bgr is None:
                raise HTTPException(status_code=400, detail="Cannot read target image")

            source_img = cv2.cvtColor(source_bgr, cv2.COLOR_BGR2RGB)
            target_img = cv2.cvtColor(target_bgr, cv2.COLOR_BGR2RGB)

            engine = _engine_state.get_engine()

            from shared.types import VideoFrame, TuningParams
            source_frame = VideoFrame(image=source_img)
            target_frame = VideoFrame(image=target_img)
            tuning = TuningParams()  # Use default tuning
            # Pass settings directly to swap instead of modifying engine state
            result_frame = engine.swap_with_options(
                source_frame, target_frame, tuning=tuning,
                use_4k=req.use_4k, no_watermark=req.no_watermark
            )

            ext = ".png"
            if req.use_4k:
                ext = ".jpg"
            output_id = f"swap_{uuid.uuid4().hex[:12]}{ext}"
            output_path = _safe_storage_path(OUTPUT_DIR, output_id)
            if not cv2.imwrite(str(output_path), cv2.cvtColor(result_frame.image, cv2.COLOR_RGB2BGR)):
                raise HTTPException(status_code=500, detail="Cannot write output image")

            _engine_state.send_virtual_cam(result_frame.image)

            return SwapResponse(
                status="success",
                output_id=output_id,
                output_url=f"/outputs/{output_id}",
            )
        except ImportError:
            raise HTTPException(status_code=500, detail="opencv-python not installed")
        except Exception as e:
            raise _http_error(e)

    @app.post("/swap-video")
    async def swap_video(source_id: str = Form(...), target_id: str = Form(...)):
        source_path = _safe_storage_path(UPLOAD_DIR, source_id)
        target_path = _safe_storage_path(UPLOAD_DIR, target_id)

        if not source_path.is_file():
            raise HTTPException(status_code=404, detail="Source file not found")
        if not target_path.is_file():
            raise HTTPException(status_code=404, detail="Target file not found")

        try:
            import cv2
            _engine_state.get_engine().require_feature("face_swap")
            source_bgr = cv2.imread(str(source_path))
            if source_bgr is None:
                raise HTTPException(status_code=400, detail="Cannot read source image")
            source_img = cv2.cvtColor(source_bgr, cv2.COLOR_BGR2RGB)
            cap = cv2.VideoCapture(str(target_path))
            if not cap.isOpened():
                raise HTTPException(status_code=400, detail="Cannot open target video")

            fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            if w <= 0 or h <= 0:
                raise HTTPException(status_code=400, detail="Target video has invalid dimensions")

            output_id = f"swap_vid_{uuid.uuid4().hex[:12]}.mp4"
            output_path = _safe_storage_path(OUTPUT_DIR, output_id)
            temp_frames_dir = OUTPUT_DIR / f"_temp_frames_{uuid.uuid4().hex[:8]}"
            temp_frames_dir.mkdir(parents=True, exist_ok=True)

            engine = _engine_state.get_engine()
            from shared.types import VideoFrame
            source_frame = VideoFrame(image=source_img)
            frames_processed = 0
            frame_idx = 0

            while True:
                ret, frame_bgr = cap.read()
                if not ret:
                    break
                frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
                result_frame = engine.swap_with_options(source_frame, VideoFrame(image=frame_rgb))
                # Save frame as PNG for lossless encoding
                frame_path = temp_frames_dir / f"frame_{frame_idx:06d}.png"
                cv2.imwrite(str(frame_path), cv2.cvtColor(result_frame.image, cv2.COLOR_RGB2BGR))
                frames_processed += 1
                frame_idx += 1

            cap.release()

            if frames_processed == 0:
                raise MediaProcessingError("target video contained no readable frames")

            # Use ffmpeg to encode frames + preserve audio from original
            try:
                import subprocess
                # Encode frames to video with ffmpeg
                ffmpeg_cmd = [
                    "ffmpeg", "-y",
                    "-framerate", str(fps),
                    "-i", str(temp_frames_dir / "frame_%06d.png"),
                    "-i", str(target_path),  # Second input for audio
                    "-c:v", "libx264", "-preset", "medium", "-crf", "18",
                    "-c:a", "aac", "-b:a", "128k",
                    "-map", "0:v:0",  # Video from frames
                    "-map", "1:a:0?",  # Audio from original (if exists)
                    "-shortest",
                    "-movflags", "+faststart",
                    str(output_path),
                ]
                result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True, timeout=300)
                if result.returncode != 0:
                    # Fallback: encode without audio
                    ffmpeg_cmd_fallback = [
                        "ffmpeg", "-y",
                        "-framerate", str(fps),
                        "-i", str(temp_frames_dir / "frame_%06d.png"),
                        "-c:v", "libx264", "-preset", "medium", "-crf", "18",
                        "-pix_fmt", "yuv420p",
                        "-movflags", "+faststart",
                        str(output_path),
                    ]
                    subprocess.run(ffmpeg_cmd_fallback, capture_output=True, timeout=300, check=True)
            except (subprocess.TimeoutExpired, FileNotFoundError):
                # Fallback to imageio if ffmpeg subprocess fails
                try:
                    import imageio.v3 as iio
                    frames = []
                    for i in range(frames_processed):
                        frame_path = temp_frames_dir / f"frame_{i:06d}.png"
                        frames.append(iio.imread(str(frame_path)))
                    iio.imwrite(str(output_path), np.array(frames), fps=fps, codec="libx264")
                except Exception:
                    # Final fallback: cv2.VideoWriter
                    out = cv2.VideoWriter(str(output_path), cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h))
                    for i in range(frames_processed):
                        frame_path = temp_frames_dir / f"frame_{i:06d}.png"
                        frame = cv2.imread(str(frame_path))
                        if frame is not None:
                            out.write(frame)
                    out.release()
            finally:
                # Cleanup temp frames
                import shutil
                shutil.rmtree(temp_frames_dir, ignore_errors=True)

            _check_write(True, output_path)

            return {
                "status": "success",
                "output_id": output_id,
                "output_url": f"/outputs/{output_id}",
                "frames": frames_processed,
            }
        except ImportError:
            raise HTTPException(status_code=500, detail="opencv-python not installed")
        except Exception as exc:
            raise _http_error(exc)

    @app.post("/live-portrait")
    async def live_portrait(req: LivePortraitRequest):
        source_path = _safe_storage_path(UPLOAD_DIR, req.source_id)
        if not source_path.is_file():
            raise HTTPException(status_code=404, detail="Source file not found")

        try:
            import cv2
            source_bgr = cv2.imread(str(source_path))
            if source_bgr is None:
                raise HTTPException(status_code=400, detail="Cannot read source image")
            source_img = cv2.cvtColor(source_bgr, cv2.COLOR_BGR2RGB)

            engine = _engine_state.get_engine()
            frames = engine.animate_portrait(source_img, req.expression, req.intensity)

            output_id = f"portrait_{uuid.uuid4().hex[:12]}.mp4"
            output_path = _safe_storage_path(OUTPUT_DIR, output_id)

            h, w = source_img.shape[:2]
            fourcc = cv2.VideoWriter_fourcc(*"mp4v")
            out = cv2.VideoWriter(str(output_path), fourcc, 30, (w, h))
            if not out.isOpened():
                raise MediaProcessingError("cannot create portrait video")
            for frame in frames:
                out.write(cv2.cvtColor(frame, cv2.COLOR_RGB2BGR))
            out.release()
            out = None
            _check_write(True, output_path)

            return {
                "status": "success",
                "output_id": output_id,
                "output_url": f"/outputs/{output_id}",
                "frames": len(frames),
            }
        except ImportError:
            raise HTTPException(status_code=500, detail="opencv-python not installed")
        except Exception as e:
            raise _http_error(e)
        finally:
            if "out" in locals() and out is not None:
                out.release()

    @app.post("/background-remove")
    async def background_remove(req: BackgroundRequest):
        file_path = _safe_storage_path(UPLOAD_DIR, req.file_id)
        if not file_path.is_file():
            raise HTTPException(status_code=404, detail="File not found")

        try:
            import cv2
            img_bgr = cv2.imread(str(file_path))
            if img_bgr is None:
                raise HTTPException(status_code=400, detail="Cannot read image")
            img = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)

            engine = _engine_state.get_engine()

            bg_img = None
            if req.bg_file_id:
                bg_path = _safe_storage_path(UPLOAD_DIR, req.bg_file_id)
                if not bg_path.is_file():
                    raise HTTPException(status_code=404, detail="Background file not found")
                bg_bgr = cv2.imread(str(bg_path))
                if bg_bgr is None:
                    raise HTTPException(status_code=400, detail="Cannot read background image")
                bg_img = cv2.cvtColor(bg_bgr, cv2.COLOR_BGR2RGB)

            bg_color = _validate_color(req.bg_color)

            if req.blur_kernel > 0:
                blur_kernel = req.blur_kernel if req.blur_kernel % 2 else req.blur_kernel + 1
                result = engine.blur_background(img, blur_kernel, req.method)
            elif bg_img is not None or bg_color is not None:
                result = engine.replace_background(img, bg_img, bg_color, req.method)
            else:
                _, result = engine.remove_background(img, req.method)

            output_id = f"bg_{uuid.uuid4().hex[:12]}.png"
            output_path = _safe_storage_path(OUTPUT_DIR, output_id)
            _check_write(cv2.imwrite(str(output_path), cv2.cvtColor(result, cv2.COLOR_RGB2BGR)), output_path)

            return {
                "status": "success",
                "output_id": output_id,
                "output_url": f"/outputs/{output_id}",
            }
        except ImportError:
            raise HTTPException(status_code=500, detail="opencv-python not installed")
        except Exception as e:
            raise _http_error(e)

    @app.post("/apply-filter")
    async def apply_filter(req: FilterRequest):
        file_path = _safe_storage_path(UPLOAD_DIR, req.file_id)
        if not file_path.is_file():
            raise HTTPException(status_code=404, detail="File not found")

        try:
            import cv2
            img_bgr = cv2.imread(str(file_path))
            if img_bgr is None:
                raise HTTPException(status_code=400, detail="Cannot read image")
            img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)

            engine = _engine_state.get_engine()
            from shared.types import VideoFrame
            frame = VideoFrame(image=img_rgb)
            result = engine.apply_filter(frame, req.filter_name, req.intensity)

            output_id = f"filter_{uuid.uuid4().hex[:12]}.png"
            output_path = _safe_storage_path(OUTPUT_DIR, output_id)
            result_bgr = cv2.cvtColor(result.image, cv2.COLOR_RGB2BGR)
            _check_write(cv2.imwrite(str(output_path), result_bgr), output_path)

            return {
                "status": "success",
                "output_id": output_id,
                "output_url": f"/outputs/{output_id}",
            }
        except ImportError:
            raise HTTPException(status_code=500, detail="opencv-python not installed")
        except Exception as e:
            raise _http_error(e)

    @app.get("/filters")
    async def list_filters():
        engine = _engine_state.get_engine()
        return {"filters": engine.list_filters()}

    @app.post("/voice-clone/add")
    async def voice_clone_add(req: VoiceCloneRequest):
        file_path = _safe_storage_path(UPLOAD_DIR, req.file_id)
        if not file_path.is_file():
            raise HTTPException(status_code=404, detail="File not found")

        try:
            import soundfile as sf
            audio, sr = sf.read(str(file_path))
            if len(audio.shape) > 1:
                audio = audio.mean(axis=1)
            audio = audio.astype(np.float32)

            engine = _engine_state.get_engine()
            engine.require_feature("voice_clone")
            engine.add_voice_sample(req.name, audio, sr)

            return {"status": "success", "voice": req.name, "samples": len(audio)}
        except ImportError:
            raise HTTPException(status_code=500, detail="soundfile not installed")
        except Exception as e:
            raise _http_error(e)

    @app.get("/voice-clone/list")
    async def voice_clone_list():
        engine = _engine_state.get_engine()
        return {"voices": engine.list_voices()}

    @app.post("/voice-clone/convert")
    async def voice_clone_convert(req: VoiceConvertRequest):
        file_path = _safe_storage_path(UPLOAD_DIR, req.file_id)
        if not file_path.is_file():
            raise HTTPException(status_code=404, detail="File not found")

        try:
            import soundfile as sf
            audio, sr = sf.read(str(file_path))
            if len(audio.shape) > 1:
                audio = audio.mean(axis=1)
            audio = audio.astype(np.float32)

            engine = _engine_state.get_engine()
            engine.require_feature("voice_convert" if not req.target_voice else "voice_clone")
            from shared.types import AudioFrame
            audio_frame = AudioFrame(samples=audio, sample_rate=sr)

            if req.target_voice:
                result = engine.clone_voice(audio_frame, req.target_voice, req.pitch_shift)
            else:
                result = engine.convert_voice(audio_frame, req.target_voice)

            import tempfile
            output_id = f"voice_{uuid.uuid4().hex[:12]}.wav"
            output_path = _safe_storage_path(OUTPUT_DIR, output_id)
            sf.write(str(output_path), result.samples, sr)
            _check_write(True, output_path)

            return {
                "status": "success",
                "output_id": output_id,
                "output_url": f"/outputs/{output_id}",
            }
        except ImportError:
            raise HTTPException(status_code=500, detail="soundfile not installed")
        except Exception as e:
            raise _http_error(e)

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
        file_path = _safe_storage_path(UPLOAD_DIR, req.file_id)
        if not file_path.is_file():
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
                output_path = _safe_storage_path(OUTPUT_DIR, output_audio_id)
                sf.write(str(output_path), tts_audio, 16000)
                _check_write(True, output_path)

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
            raise _http_error(e)

    @app.post("/watermark")
    async def toggle_watermark(enabled: bool = Form(...)):
        engine = _engine_state.get_engine()
        engine.set_watermark(enabled)
        return {"status": "ok", "watermark_enabled": enabled}

    @app.post("/tracking")
    async def set_tracking(enabled: bool = Form(...)):
        engine = _engine_state.get_engine()
        engine.set_tracking(enabled)
        return {"status": "ok", "tracking_enabled": enabled}

    @app.post("/tracking/expression-transfer")
    async def set_expression_transfer(enabled: bool = Form(...)):
        engine = _engine_state.get_engine()
        engine.set_expression_transfer(enabled)
        return {"status": "ok", "expression_transfer_enabled": enabled}

    @app.post("/tracking/head-pose-transfer")
    async def set_head_pose_transfer(enabled: bool = Form(...)):
        engine = _engine_state.get_engine()
        engine.set_head_pose_transfer(enabled)
        return {"status": "ok", "head_pose_transfer_enabled": enabled}

    @app.post("/tracking/hand-overlay")
    async def set_hand_overlay(enabled: bool = Form(...)):
        engine = _engine_state.get_engine()
        engine.set_hand_overlay(enabled)
        return {"status": "ok", "hand_overlay_enabled": enabled}

    @app.post("/upload")
    async def upload(file: UploadFile = File(...)):
        original_name = Path(file.filename or "upload.bin").name
        suffix = Path(original_name).suffix.lower()
        if suffix not in ALLOWED_UPLOAD_EXTENSIONS:
            raise HTTPException(status_code=415, detail="Unsupported file type")

        file_id = f"{uuid.uuid4().hex[:12]}{suffix}"
        file_path = _safe_storage_path(UPLOAD_DIR, file_id)
        size = 0
        with file_path.open("wb") as destination:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    file_path.unlink(missing_ok=True)
                    raise HTTPException(status_code=413, detail="File exceeds 100 MB limit")
                destination.write(chunk)

        return {
            "file_id": file_id,
            "filename": original_name,
            "size": size,
            "mime": file.content_type or "application/octet-stream",
        }

    @app.post("/set-source")
    async def set_source(file_id: str = Form(...)):
        file_path = _safe_storage_path(UPLOAD_DIR, file_id)
        if not file_path.is_file():
            raise HTTPException(status_code=404, detail="File not found")
        try:
            engine = _engine_state.get_engine()
            engine.require_feature("face_swap")
            import cv2
            img_bgr = cv2.imread(str(file_path))
            if img_bgr is None:
                raise HTTPException(status_code=400, detail="Cannot read image")
            img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
            ok = engine.set_source(img_rgb)
            return {"status": "ok", "faces_detected": ok}
        except ImportError:
            raise HTTPException(status_code=500, detail="opencv-python not installed")
        except Exception as e:
            raise _http_error(e)

    @app.get("/files/{file_id}")
    async def get_file(file_id: str):
        file_path = _safe_storage_path(UPLOAD_DIR, file_id)
        if not file_path.is_file():
            raise HTTPException(status_code=404, detail="File not found")
        return FileResponse(str(file_path))

    @app.get("/outputs/{output_id}")
    async def get_output(output_id: str):
        output_path = _safe_storage_path(OUTPUT_DIR, output_id)
        if not output_path.is_file():
            raise HTTPException(status_code=404, detail="Output not found")
        return FileResponse(str(output_path))

    @app.websocket("/stream")
    async def stream(ws: WebSocket):
        await ws.accept()
        engine = _engine_state.get_engine()
        tracking_enabled = True
        min_frame_interval = 1.0 / 30.0  # Max 30 FPS
        try:
            while True:
                data = await ws.receive_bytes()
                now = time.monotonic()
                arr = np.frombuffer(data, dtype=np.uint8)
                try:
                    import cv2
                    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                    if img is not None:
                        from shared.types import VideoFrame
                        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

                        if engine.has_source():
                            tracking_result = engine.process_frame_with_tracking(img_rgb)
                            tracked_frame = tracking_result["frame"]
                            target_frame = VideoFrame(image=tracked_frame)
                            source_frame = VideoFrame(image=np.zeros_like(img_rgb))
                            result = engine.swap(source_frame, target_frame)
                            _engine_state.send_virtual_cam(result.image)
                            _, buf = cv2.imencode(".jpg", result.image)
                            await ws.send_bytes(buf.tobytes())
                            if tracking_result.get("tracking"):
                                await ws.send_json({"tracking": tracking_result["tracking"]})
                        else:
                            _, buf = cv2.imencode(".jpg", img_rgb)
                            await ws.send_bytes(buf.tobytes())
                    else:
                        await ws.send_json({"error": "invalid image frame"})
                except ImportError as exc:
                    await ws.send_json({"error": f"opencv unavailable: {exc}"})
                elapsed = time.monotonic() - now
                if elapsed < min_frame_interval:
                    await asyncio.sleep(min_frame_interval - elapsed)
        except WebSocketDisconnect:
            logger.info("stream client disconnected")
        except Exception as exc:
            logger.exception("websocket stream failed")
            try:
                await ws.send_json({"error": "stream processing failed"})
                await ws.close(code=1011, reason=str(exc)[:120])
            except Exception:
                logger.debug("could not send websocket error", exc_info=True)

    @app.get("/mjpeg")
    async def mjpeg_stream():
        import cv2
        import asyncio
        from concurrent.futures import ThreadPoolExecutor

        camera_source = os.environ.get("CAMERA_SOURCE", "http://localhost:8080/video")
        engine = _engine_state.get_engine()
        loop = asyncio.get_event_loop()
        pool = ThreadPoolExecutor(max_workers=1)

        def _read_frame(cap):
            ret, frame = cap.read()
            return ret, frame

        cap = await loop.run_in_executor(pool, cv2.VideoCapture, camera_source)

        async def generate():
            try:
                while True:
                    ret, frame = await loop.run_in_executor(pool, _read_frame, cap)
                    if not ret:
                        await asyncio.sleep(0.1)
                        continue
                    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    from shared.types import VideoFrame
                    target = VideoFrame(image=frame_rgb)
                    source = VideoFrame(image=np.zeros_like(frame_rgb))
                    result = engine.swap(source, target)
                    _, buf = cv2.imencode(".jpg", cv2.cvtColor(result.image, cv2.COLOR_RGB2BGR))
                    yield (
                        b"--frame\r\n"
                        b"Content-Type: image/jpeg\r\n\r\n" +
                        buf.tobytes() + b"\r\n"
                    )
            finally:
                cap.release()
                pool.shutdown(wait=True)

        return StreamingResponse(
            generate(),
            media_type="multipart/x-mixed-replace; boundary=frame",
        )

    return app
