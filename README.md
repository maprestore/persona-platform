
# Persona Platform

> Real-time identity & persona transformation — face, body, voice, and beyond.
> Works on **phone (Termux/Android)** and **laptop (Linux/macOS)**.

## Quick Start

```bash
# Install (auto-detects platform)
./setup.sh

# Or install each package manually
pip install -e packages/shared
pip install -e packages/persona-swap-core
pip install -e packages/sdk
```

## Usage

### On laptop
```bash
# Start server with web UI
./run.sh --image ~/my_face.jpg

# Or just the API server
./start.sh --source ~/my_face.jpg

# Open http://localhost:6967/cam in browser
```

### On phone (Termux/Android)
```bash
# Start in phone mode (CPU, no virtual camera)
./start.sh
# OR
python3 -m cli phone

# Open http://localhost:6967/cam locally
# Or from another device: http://<phone-ip>:6967/cam
```

### Phone as remote camera (for laptop processing)
1. Start server on laptop: `./start.sh --source ~/face.jpg`
2. Open `http://laptop-ip:6967/cam` in phone browser
3. Tap the **Pair** button and scan QR code, or
4. Open `http://laptop-ip:6967/phone` for minimal camera-only view
5. Phone camera streams to laptop for face swap processing

## Architecture

```
persona-platform/
├── packages/
│   ├── persona-swap-core/   # Real-time face/body/voice swap engine
│   ├── video-animate/       # Animated avatar puppeteering
│   ├── scene-composer/      # Multi-person & background composition
│   ├── semantic-scene/      # Scene understanding & relighting
│   ├── cross-modal/         # Text/audio -> face/body generation
│   ├── on-device-engine/    # Runtime optimizer (ONNX/TensorRT/CoreML)
│   ├── sdk/                 # FastAPI API server + Python SDK + Web UI
│   ├── no-code-pipeline/    # Drag-and-drop pipeline builder
│   └── shared/              # shared types, utils, protocols
├── cli.py                   # CLI entry point (serve/run/cam/swap/phone)
├── setup.sh                 # Cross-platform setup (Termux + desktop)
├── start.sh                 # Quick server start
└── run.sh                   # Full launcher with frontend
```

## Cross-Platform Features

| Feature | Phone (Termux) | Laptop |
|---------|---------------|--------|
| Face swap | ✅ (CPU) | ✅ (CPU/CUDA) |
| Web UI | ✅ Mobile-optimized | ✅ Desktop-optimized |
| Phone as camera | ✅ Streams to server | ✅ Receives from phone |
| /cam page | ✅ Touch controls | ✅ Mouse controls |
| /phone page | ✅ Minimal camera UI | ❌ |
| Virtual camera | ❌ N/A | ✅ v4l2loopback/pyvirtualcam |
| Frontend UI | ❌ Skipped | ✅ Vite dev server |

## CLI Commands

```bash
persona serve          # Start API server
persona run            # Full stack (server + cam + frontend)
persona phone          # Phone-optimized mode
persona cam list       # List cameras
persona swap src dst   # Quick face swap
```

## API Endpoints

- `GET /cam` — Mobile-responsive webcam face swap UI
- `GET /phone` — Minimal phone camera sender
- `GET /health` — Server status
- `POST /swap` — Face swap two images
- `POST /swap-video` — Face swap video
- `POST /upload` — Upload file
- `POST /set-source` — Set source face
- `POST /virtual-cam/start|stop` — Virtual camera control
- `POST /live-portrait` — Animate portrait
- `POST /background-remove` — Remove/replace background
- `POST /apply-filter` — Apply image filter
- `POST /voice-clone/*` — Voice cloning
- `WebSocket /stream` — Real-time frame streaming

## Requirements

- OS: Linux (including Termux), macOS
- Python: 3.10+
- RAM: 4 GB minimum, 8 GB recommended
- GPU: Optional (CUDA for faster performance)

## License

MIT
