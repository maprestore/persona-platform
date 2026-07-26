#!/usr/bin/env bash
set -euo pipefail

echo "=== Persona Studio Setup ==="

PYTHON=$(command -v python3 || command -v python)

# Create venv
if [ ! -d .venv ]; then
    $PYTHON -m venv .venv
    echo "Virtual environment created"
fi

source .venv/bin/activate

pip install --upgrade pip setuptools wheel

# Install all packages
pip install -e packages/shared
pip install -e packages/persona-swap-core
pip install -e packages/magiclip
pip install -e packages/sdk
pip install -e packages/no-code-pipeline

# Install pyvirtualcam for ManyCam/OBS/virtual camera support
pip install pyvirtualcam 2>/dev/null || echo "pyvirtualcam not available (install manually on Windows: pip install pyvirtualcam)"

# Install optional ML deps
pip install -e "packages/persona-swap-core[all]" 2>/dev/null || true

# Install frontend deps (optional)
if command -v npm &>/dev/null; then
    cd packages/no-code-pipeline/frontend
    npm install 2>/dev/null || true
    cd ../..
fi

echo ""
echo "=== Setup complete ==="
echo ""
echo "Quick start:"
echo "  source .venv/bin/activate"
echo "  ./run.sh                           # Start everything"
echo "  ./run.sh --image ~/my_face.jpg     # Start with source photo"
echo ""
echo "For video calls:"
echo "  1. Start: ./run.sh"
echo "  2. Open http://localhost:5173 in browser"
echo "  3. Upload source face, swap, send to virtual camera"
echo "  4. Select 'Persona Camera' in Zoom/Teams/Discord"
echo ""
