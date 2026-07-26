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
from fastapi.responses import FileResponse, StreamingResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
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

    if cameras:
        return cameras

    cameras.append({
        "device": "pyvirtualcam",
        "name": "pyvirtualcam (ManyCam/OBS/Virtual Camera)",
        "type": "virtual",
        "driver": "pyvirtualcam",
    })

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


FRONTEND_DIST = Path(__file__).parent.parent.parent.parent / "no-code-pipeline" / "frontend" / "dist"
FRONTEND_DEV = Path(__file__).parent.parent.parent.parent / "no-code-pipeline" / "frontend"

WEBPAGE_INDEX = """\
<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Persona Studio</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:#0f0f13;color:#e4e4e7;min-height:100vh}
.header{background:#1a1a24;border-bottom:1px solid #2a2a35;padding:16px 24px;display:flex;align-items:center;gap:12px}
.header h1{font-size:20px;font-weight:600;background:linear-gradient(135deg,#818cf8,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.logo{width:32px;height:32px;background:#4f46e5;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;color:#fff}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;padding:24px;max-width:960px;margin:0 auto}
.card{background:#1a1a24;border:1px solid #2a2a35;border-radius:12px;padding:20px;text-decoration:none;color:inherit;transition:border-color .2s}
.card:hover{border-color:#4f46e5}
.card-icon{font-size:32px;margin-bottom:12px}
.card h3{font-size:16px;font-weight:600;margin-bottom:6px}
.card p{font-size:13px;color:#a1a1aa;line-height:1.5}
.badge{display:inline-block;font-size:11px;padding:2px 8px;border-radius:4px;font-weight:500;margin-top:8px}
.badge-green{background:#05966920;color:#34d399;border:1px solid #05966940}
.footer{text-align:center;padding:24px;color:#52525b;font-size:13px}
</style></head><body>
<div class="header">
<div class="logo">&#x1f3ac;</div>
<h1>Persona Studio</h1>
</div>
<div class="grid">
<a href="/cam" class="card">
<div class="card-icon">&#x1f4f7;</div>
<h3>Live Webcam</h3>
<p>Real-time face swap using your camera &mdash; share this tab in any video call</p>
<div class="badge badge-green">Works with screen share</div>
</a>
<a href="/ui/" class="card">
<div class="card-icon">&#x1f3a8;</div>
<h3>Persona Studio UI</h3>
<p>Full-featured studio with swap, filters, background removal, and more</p>
</a>
<a href="/docs" class="card" onclick="event.preventDefault();alert('API endpoints:\\n/health - Server status\\n/swap - Face swap\\n/upload - Upload files\\n/cameras - List cameras\\n/virtual-cam/* - Virtual camera control\\n/live-portrait - Animate portraits\\n/background-remove - BG removal\\n/apply-filter - Filters\\n/voice-clone/* - Voice cloning\\n/translate - AI translation\\n/tuning - Advanced tuning')">
<div class="card-icon">&#x1f4e1;</div>
<h3>API</h3>
<p>REST API at / for programmatic access &mdash; all endpoints available</p>
</a>
</div>
<div class="footer">Persona Studio v0.1.0 &mdash; Face swap for video calls</div>
</body></html>
"""

WEBPAGE_CAM = """\
<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
<title>Persona Studio - Live Cam</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:#000;color:#fff;overflow:hidden;height:100dvh;display:flex;flex-direction:column}
.video-container{flex:1;display:flex;align-items:center;justify-content:center;position:relative;background:#0a0a0a;min-height:0}
.video-container video{max-width:100%;max-height:100%;object-fit:contain;border-radius:0}
#sourceVideo{display:none}
#resultVideo{width:100%;height:100%;object-fit:contain}
.overlay{position:absolute;top:16px;left:16px;right:16px;display:flex;justify-content:space-between;pointer-events:none}
.status-badge{padding:6px 14px;border-radius:20px;font-size:13px;font-weight:500;backdrop-filter:blur(8px)}
.status-ok{background:#05966940;color:#34d399;border:1px solid #05966980}
.status-warn{background:#d9770640;color:#fbbf24;border:1px solid #d9770680}
.status-err{background:#dc262640;color:#f87171;border:1px solid #dc262680}
.controls{background:#1a1a24;border-top:1px solid #2a2a35;padding:12px 16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.controls button{padding:10px 20px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:all .2s;flex-shrink:0}
.btn-start{background:#4f46e5;color:#fff}
.btn-start:hover{background:#4338ca}
.btn-start:disabled{opacity:.4;cursor:not-allowed}
.btn-stop{background:#dc2626;color:#fff}
.btn-stop:hover{background:#b91c1c}
.btn-secondary{background:#2a2a35;color:#e4e4e7}
.btn-secondary:hover{background:#3a3a45}
.controls select{background:#2a2a35;color:#e4e4e7;border:1px solid #3a3a45;border-radius:6px;padding:8px 12px;font-size:13px;flex:1;min-width:100px}
.controls label{font-size:12px;color:#a1a1aa;display:flex;align-items:center;gap:8px}
.controls input[type=file]{display:none}
.file-label{padding:8px 14px;background:#2a2a35;border-radius:6px;font-size:12px;color:#a1a1aa;cursor:pointer;border:1px dashed #3a3a45;flex-shrink:0}
.file-label:hover{background:#3a3a45}
.swap-toggle{display:flex;gap:4px;background:#2a2a35;border-radius:8px;padding:3px}
.swap-toggle button{padding:6px 14px;border:none;border-radius:6px;font-size:12px;cursor:pointer;transition:all .15s;background:transparent;color:#a1a1aa;font-weight:500}
.swap-toggle button.active{background:#4f46e5;color:#fff}
#mirrorToggle{padding:8px;background:transparent;border:1px solid #3a3a45;border-radius:6px;color:#a1a1aa;cursor:pointer;font-size:16px}
#mirrorToggle.active{border-color:#4f46e5;color:#4f46e5}
.hint{text-align:center;font-size:12px;color:#52525b;padding:6px;border-top:1px solid #1a1a24;background:#0f0f13}
@media(max-width:480px){.controls{padding:8px 10px;gap:6px}.controls button{padding:8px 14px;font-size:13px}}
</style></head><body>
<div class="video-container">
<video id="sourceVideo" autoplay playsinline muted></video>
<canvas id="resultCanvas" style="width:100%;height:100%;object-fit:contain"></canvas>
<div class="overlay">
<span id="statusBadge" class="status-badge status-warn">Starting camera...</span>
<span id="fpsBadge" class="status-badge status-warn">0 FPS</span>
</div>
</div>
<div class="controls">
<button id="startBtn" class="btn-start">Start Camera</button>
<button id="stopBtn" class="btn-stop" style="display:none">Stop</button>
<div class="swap-toggle">
<button id="modeLive" class="active">Live</button>
<button id="modePhoto">Photo</button>
</div>
<label for="sourceInput" class="file-label" id="fileLabel">+ Source Face</label>
<input type="file" id="sourceInput" accept="image/*">
<label>
<select id="cameraSelect"><option value="">Default camera</option></select>
</label>
<button id="mirrorToggle">&#x1f53a;</button>
</div>
<div id="facingHint" class="hint">&#x1f4f1; Use front camera for selfie &bull; Screen share this tab in your video call app</div>
<script>
const WS_URL = (location.protocol==='https:'?'wss:':'ws:')+'//'+location.host+'/stream';
const API_BASE = '';
let ws=null, ctx=null, stream=null, animFrame=null, sourceFaceId=null;
let mirror=true, mode='live', lastTime=0, fps=0, frameCount=0, fpsInterval=null;
const srcVideo=document.getElementById('sourceVideo');
const resultCanvas=document.getElementById('resultCanvas');
const statusBadge=document.getElementById('statusBadge');
const fpsBadge=document.getElementById('fpsBadge');
const startBtn=document.getElementById('startBtn');
const stopBtn=document.getElementById('stopBtn');
const sourceInput=document.getElementById('sourceInput');
const fileLabel=document.getElementById('fileLabel');
const cameraSelect=document.getElementById('cameraSelect');
const mirrorToggle=document.getElementById('mirrorToggle');

function setStatus(text,type){
 statusBadge.textContent=text;
 statusBadge.className='status-badge status-'+type;
}

function setFps(val){
 fpsBadge.textContent=val+' FPS';
 fpsBadge.className='status-badge '+(val>20?'status-ok':'status-warn');
}

function connectWs(){
 if(ws)try{ws.close()}catch(e){}
 ws=new WebSocket(WS_URL);
 ws.onopen=()=>{setStatus('Connected','ok')};
 ws.onmessage=(ev)=>{
  if(ev.data instanceof Blob){
   const url=URL.createObjectURL(ev.data);
   const img=new Image();
   img.onload=()=>{
    ctx||(resultCanvas.getContext('2d'));
    resultCanvas.width=img.width;
    resultCanvas.height=img.height;
    ctx=resultCanvas.getContext('2d');
    if(mirror){
     ctx.save();
     ctx.translate(img.width,0);
     ctx.scale(-1,1);
     ctx.drawImage(img,0,0);
     ctx.restore();
    }else{
     ctx.drawImage(img,0,0);
    }
    URL.revokeObjectURL(url);
    frameCount++;
   };
   img.src=url;
  }
 };
 ws.onerror=()=>{setStatus('Disconnected','err')};
 ws.onclose=()=>{setStatus('Disconnected','err');ws=null};
}

function sendFrame(video){
 if(!ws||ws.readyState!==1||!video.videoWidth)return;
 const c=document.createElement('canvas');
 c.width=Math.min(video.videoWidth,640);
 c.height=Math.min(video.videoHeight,480);
 const cx=c.getContext('2d');
 cx.drawImage(video,0,0,c.width,c.height);
 c.toBlob(blob=>{if(ws&&ws.readyState===1)ws.send(blob)},'image/jpeg',0.7);
}

async function startCamera(){
 try{
  const facing=cameraSelect.value||'user';
  stream=await navigator.mediaDevices.getUserMedia({
   video:{facingMode:facing,width:{ideal:640},height:{ideal:480}},
   audio:false
  });
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
 }catch(e){
  setStatus('Camera error: '+e.message,'err');
 }
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
 const form=new FormData();
 form.append('file',file);
 try{
  const res=await fetch(API_BASE+'/upload',{method:'POST',body:form});
  const data=await res.json();
  sourceFaceId=data.file_id;
  const setRes=await fetch(API_BASE+'/set-source',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'file_id='+encodeURIComponent(data.file_id)});
  fileLabel.textContent='\\u2705 '+file.name;
  fileLabel.style.borderColor='#34d399';
  setStatus('Source face loaded','ok');
  if(mode==='photo'){await uploadTargetAndSwap();}
 }catch(e){
  fileLabel.textContent='Upload failed';
  setStatus('Upload error','err');
 }
}

async function uploadAndSwap(imgData){
 if(!sourceFaceId)return;
 try{
  const blob=await new Promise(r=>imgData.toBlob(r,'image/png'));
  const form=new FormData();
  form.append('file',new File([blob],'selfie.png'));
  const up=await fetch(API_BASE+'/upload',{method:'POST',body:form});
  const upData=await up.json();
  const res=await fetch(API_BASE+'/swap',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({source_id:sourceFaceId,target_id:upData.file_id,no_watermark:true})
  });
  const swapData=await res.json();
  if(swapData.output_url){
   const img=new Image();
   img.onload=()=>{
    resultCanvas.width=img.width;
    resultCanvas.height=img.height;
    ctx=resultCanvas.getContext('2d');
    if(mirror){ctx.save();ctx.translate(img.width,0);ctx.scale(-1,1);ctx.drawImage(img,0,0);ctx.restore()}
    else ctx.drawImage(img,0,0);
   };
   img.src=API_BASE+swapData.output_url;
  }
 }catch(e){console.error(e)}
}

sourceInput.addEventListener('change',e=>{
 if(e.target.files[0])uploadSourceFace(e.target.files[0]);
});

startBtn.addEventListener('click',startCamera);
stopBtn.addEventListener('click',stopCamera);

mirrorToggle.addEventListener('click',()=>{
 mirror=!mirror;
 mirrorToggle.classList.toggle('active');
});

document.getElementById('modeLive').addEventListener('click',()=>{
 mode='live';
 document.getElementById('modeLive').classList.add('active');
 document.getElementById('modePhoto').classList.remove('active');
 setStatus('Live mode','ok');
});

document.getElementById('modePhoto').addEventListener('click',()=>{
 mode='photo';
 document.getElementById('modePhoto').classList.add('active');
 document.getElementById('modeLive').classList.remove('active');
 if(sourceFaceId){
  const c=document.createElement('canvas');
  c.width=srcVideo.videoWidth||640;
  c.height=srcVideo.videoHeight||480;
  const cx=c.getContext('2d');
  cx.drawImage(srcVideo,0,0);
  uploadAndSwap(c);
 }
 setStatus('Photo mode: capture & swap','warn');
});

// Enumerate cameras
navigator.mediaDevices.enumerateDevices().then(devs=>{
 devs.filter(d=>d.kind==='videoinput').forEach((d,i)=>{
  const opt=document.createElement('option');
  opt.value=d.deviceId;
  opt.text=d.label||'Camera '+(i+1);
  cameraSelect.appendChild(opt);
 });
}).catch(()=>{});

setStatus('Click Start Camera','warn');
</script>
</body></html>
"""


def create_app() -> FastAPI:
    app = FastAPI(title="Persona Studio", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    frontend_dist = FRONTEND_DIST
    frontend_dev = FRONTEND_DEV
    frontend_index = frontend_dist / "index.html"

    if frontend_dist.exists() and frontend_index.exists():
        app.mount("/ui", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")
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
            from persona_swap_core.virtual_cam import VirtualCamera
            cam = VirtualCamera(name=req.device, width=req.width, height=req.height, fps=req.fps)
            ok = cam.start()
            if ok:
                _engine_state._virtual_cam = cam
                _engine_state._cam_active = True
                return {"status": "ok", "device": req.device, "resolution": f"{req.width}x{req.height}", "fps": req.fps}
            return {"status": "error", "message": "Failed to start virtual camera"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    @app.post("/virtual-cam/stop")
    async def stop_virtual_cam():
        _engine_state.stop_virtual_cam()
        return {"status": "ok"}

    @app.get("/virtual-cam/status")
    async def virtual_cam_status():
        active = _engine_state._cam_active
        vcam = _engine_state._virtual_cam
        device = vcam.name if vcam else None
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
                result_frame = engine.swap_with_options(source_frame, target_frame)
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

    @app.post("/set-source")
    async def set_source(file_id: str = Form(...)):
        file_path = UPLOAD_DIR / file_id
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
        try:
            import cv2
            img = cv2.imread(str(file_path))
            if img is None:
                raise HTTPException(status_code=400, detail="Cannot read image")
            engine = _engine_state.get_engine()
            ok = engine.set_source(img)
            return {"status": "ok", "faces_detected": ok}
        except ImportError:
            raise HTTPException(status_code=500, detail="opencv-python not installed")
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

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
                        target_frame = VideoFrame(image=img)
                        # Swap stored source face with incoming target frame
                        source_frame = VideoFrame(image=np.zeros_like(img))  # placeholder, engine uses _source_faces
                        result = engine.swap(source_frame, target_frame)

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
