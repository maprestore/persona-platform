#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════╗"
echo "║        Persona Studio Launcher           ║"
echo "║  Real-time Face Swap & Voice Change      ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

# --- Parse args ---
PORT=${PORT:-6967}
FRONTEND_PORT=${FRONTEND_PORT:-5173}
HOST=${HOST:-127.0.0.1}
SOURCE=""
SOURCE_TYPE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source) SOURCE="$2"; shift 2 ;;
    --image) SOURCE="$2"; SOURCE_TYPE="image"; shift 2 ;;
    --video) SOURCE="$2"; SOURCE_TYPE="video"; shift 2 ;;
    --port) PORT="$2"; shift 2 ;;
    --host) HOST="$2"; shift 2 ;;
    --no-frontend) NO_FRONTEND=1 ;;
    --help)
      echo "Usage: ./run.sh [options]"
      echo ""
      echo "Options:"
      echo "  --source PATH     Image/video file to use as face source"
      echo "  --image PATH      Use image file as face source"
      echo "  --video PATH      Use video file as face source"
      echo "  --port PORT       API server port (default: 6967)"
      echo "  --host HOST       Bind address (default: 127.0.0.1)"
      echo "  --no-frontend     Skip starting frontend dev server"
      echo ""
      echo "Examples:"
      echo "  ./run.sh                                  # Start server + frontend"
      echo "  ./run.sh --image ~/face.jpg               # Start with source face"
      echo "  ./run.sh --video ~/input.mp4              # Start with source video"
      echo "  ./run.sh --source ~/face.jpg --no-frontend # Headless mode"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# --- Check if venv exists, create if not ---
if [ ! -d .venv ]; then
    echo -e "${YELLOW}Creating virtual environment...${NC}"
    python3 -m venv .venv
    source .venv/bin/activate
    pip install --upgrade pip setuptools wheel
    pip install -e packages/shared
    pip install -e packages/persona-swap-core
    pip install -e packages/sdk
    pip install -e packages/magiclip
    pip install -e packages/no-code-pipeline
    pip install pyvirtualcam 2>/dev/null || true
    echo -e "${GREEN}Setup complete${NC}"
else
    source .venv/bin/activate
fi

# --- Start API server ---
echo -e "${GREEN}Starting API server on ${HOST}:${PORT}...${NC}"
API_PID=""
if [ -n "$SOURCE" ]; then
    python3 -m persona run --host "$HOST" --port "$PORT" --source "$SOURCE" &
    API_PID=$!
else
    python3 -m persona serve --host "$HOST" --port "$PORT" &
    API_PID=$!
fi

sleep 2

# --- Start frontend (optional) ---
FRONTEND_PID=""
if [ -z "${NO_FRONTEND:-}" ]; then
    echo -e "${GREEN}Starting frontend on ${HOST}:${FRONTEND_PORT}...${NC}"
    cd packages/no-code-pipeline/frontend
    if [ ! -d node_modules ]; then
        npm install 2>/dev/null || echo -e "${YELLOW}npm not found, skipping frontend install${NC}"
    fi
    if command -v npm &>/dev/null; then
        npx vite --host "$HOST" --port "$FRONTEND_PORT" &
        FRONTEND_PID=$!
    else
        echo -e "${YELLOW}npm not installed, skipping frontend${NC}"
    fi
    cd "$SCRIPT_DIR"
fi

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}  ${GREEN}Persona Studio is running!${NC}                              ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}                                                      ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  ${YELLOW}Web Interface:${NC}  http://${HOST}:${FRONTEND_PORT}                ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  ${YELLOW}API Server:${NC}     http://${HOST}:${PORT}                      ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}                                                      ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  ${YELLOW}Virtual Camera:${NC}  Use ManyCam/OBS to capture output       ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  ${YELLOW}For Video Calls:${NC} Select 'Persona Camera' in Zoom/Teams    ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}                                                      ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  ${YELLOW}To stop:${NC}  Press Ctrl+C                                  ${CYAN}║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# --- Trap Ctrl+C and clean up ---
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down...${NC}"
    [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null || true
    [ -n "$API_PID" ] && kill "$API_PID" 2>/dev/null || true
    wait 2>/dev/null || true
    echo -e "${GREEN}Done${NC}"
    exit 0
}
trap cleanup SIGINT SIGTERM

# Wait for either process to exit
wait
