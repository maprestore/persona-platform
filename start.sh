#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-6967}"
SOURCE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source|--image|--video) SOURCE="$2"; shift 2 ;;
    --port) PORT="$2"; shift 2 ;;
    --host) HOST="$2"; shift 2 ;;
    *) echo "Usage: ./start.sh [--source photo.jpg] [--port 6967]"; exit 0 ;;
  esac
done

PYTHON=$(command -v python3 || command -v python)

echo "Starting Persona Studio on http://$HOST:$PORT"
echo "  Webcam page: http://$HOST:$PORT/cam"
echo ""

PYTHONPATH="packages/shared/src:packages/persona-swap-core/src:packages/sdk/src:packages/magiclip/src"
export PYTHONPATH

if [ -n "$SOURCE" ]; then
  $PYTHON -c "
import sys, os, cv2
sys.path = os.environ['PYTHONPATH'].split(':') + sys.path
from sdk.server import create_app, _engine_state
import uvicorn

app = create_app()
engine = _engine_state.get_engine()
img = cv2.imread('$SOURCE')
if img is not None:
    engine.set_source(img)
    print('Source face loaded: $SOURCE')
uvicorn.run(app, host='$HOST', port=$PORT)
"
else
  $PYTHON -c "
import sys, os
sys.path = os.environ['PYTHONPATH'].split(':') + sys.path
from sdk.server import create_app
import uvicorn
uvicorn.run(create_app(), host='$HOST', port=$PORT)
"
fi
