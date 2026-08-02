
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

detect_platform() {
  if [[ -n "${TERMUX_VERSION:-}" ]]; then
    echo "termux"
  elif [[ "$(uname -s)" == "Linux" ]]; then
    echo "linux"
  elif [[ "$(uname -s)" == "Darwin" ]]; then
    echo "macos"
  else
    echo "other"
  fi
}

PLATFORM=$(detect_platform)
echo -e "${CYAN}=== Persona Studio Setup (${PLATFORM}) ===${NC}"

PYTHON=$(command -v python3 || command -v python)
if [[ -z "$PYTHON" ]]; then
  echo -e "${YELLOW}Python 3 not found. Install it first.${NC}"
  if [[ "$PLATFORM" == "termux" ]]; then
    echo "  pkg install python"
  fi
  exit 127
fi

if [[ ! -d .venv ]]; then
  echo "Creating virtual environment..."
  "$PYTHON" -m venv .venv
fi
source .venv/bin/activate

pip install --upgrade pip setuptools wheel

pip install -e packages/shared
pip install -e packages/persona-swap-core
pip install -e packages/magiclip
pip install -e packages/sdk
pip install -e packages/no-code-pipeline

if ! pip install pyvirtualcam 2>/dev/null; then
  echo -e "${YELLOW}pyvirtualcam not available; virtual camera disabled${NC}"
fi

case "$PLATFORM" in
  termux)
    echo -e "${YELLOW}Detected Termux (Android). Applying platform tweaks...${NC}"
    pip install numpy opencv-python --no-deps 2>/dev/null || true
    echo -e "${GREEN}Tip: Run './start.sh' to start the server and web UI.${NC}"
    echo -e "${GREEN}     Open http://localhost:6967/cam in a browser on the same network.${NC}"
    ;;
  linux)
    echo -e "${YELLOW}Optional: Install v4l2loopback for virtual camera:${NC}"
    echo "  sudo apt install v4l2loopback-dkms v4l2loopback-utils"
    echo "  sudo modprobe v4l2loopback"
    ;;
  macos)
    echo -e "${YELLOW}Optional: Install OBS Virtual Camera for macOS.${NC}"
    ;;
esac

if command -v npm &>/dev/null; then
  cd packages/no-code-pipeline/frontend
  if [[ -f package.json ]]; then
    npm install 2>/dev/null && echo -e "${GREEN}Frontend deps installed${NC}" || echo -e "${YELLOW}Frontend install skipped${NC}"
  fi
  cd "$SCRIPT_DIR"
fi

echo ""
echo -e "${GREEN}=== Setup complete ===${NC}"
echo ""
echo -e "${CYAN}Quick start:${NC}"
echo "  source .venv/bin/activate"
echo "  ./start.sh                         # Start API server"
echo ""
echo -e "${CYAN}On this device:${NC}"
echo "  Open http://localhost:6967/cam"
echo ""
echo -e "${CYAN}Or use your phone as remote camera:${NC}"
echo "  1. Start server: ./start.sh"
echo "  2. Open /cam page, tap 'Pair' button"
echo "  3. Scan QR code with your phone"
echo "  4. Phone camera streams to this server"
echo ""
