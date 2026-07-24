#!/usr/bin/env bash
set -euo pipefail

echo "=== Persona Platform Setup ==="

# Check Python version
PYTHON=$(command -v python3 || command -v python)
REQUIRED="3.10"
$PYTHON -c "import sys; ver = f'{sys.version_info.major}.{sys.version_info.minor}'; assert ver >= '$REQUIRED', f'Need Python >= $REQUIRED, got {ver}'"
echo "Python OK: $($PYTHON --version)"

# Create venv
if [ ! -d .venv ]; then
    $PYTHON -m venv .venv
    echo "Virtual environment created"
fi

source .venv/bin/activate

# Upgrade pip
pip install --upgrade pip setuptools wheel

# Install all packages
pip install -e packages/shared
pip install -e packages/on-device-engine
pip install -e packages/persona-swap-core
pip install -e packages/sdk
pip install -e packages/no-code-pipeline

# Install optional ML deps
pip install -e "packages/persona-swap-core[all]" 2>/dev/null || true

echo ""
echo "=== Setup complete ==="
echo "Run: source .venv/bin/activate"
echo "Then: persona serve"