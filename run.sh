#!/usr/bin/env bash
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════╗"
echo "║        Persona Studio Launcher           ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

if [ -f ".venv/bin/python" ]; then
    exec .venv/bin/python run_persona.py "$@"
else
    exec python3 run_persona.py "$@"
fi
