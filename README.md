# Persona Platform

> Real-time identity & persona transformation — face, body, voice, and beyond.

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
│   ├── sdk/                 # FastAPI-based API server + Python SDK
│   ├── no-code-pipeline/    # Drag-and-drop pipeline builder
│   └── shared/              # shared types, utils, protocols
├── docker/                  # Dockerfiles
├── .github/                 # CI/CD
└── example/                 # usage examples
```

## Quick Start

```bash
# Install
pip install persona-platform[all]

# CLI usage
persona swap --face-source ./my_face.jpg

# SDK
persona serve

# Pipeline (no-code)
persona pipeline run ./example_pipeline.json
```

## Requirements

- OS: Linux, macOS, Windows
- GPU: RTX 3060+ recommended for real-time
- RAM: 8 GB minimum
- Python: 3.10+

## License

MIT
