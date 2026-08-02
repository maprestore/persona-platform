#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"
source .venv/bin/activate

echo "========================================"
echo "   Persona Studio SaaS - Starting"
echo "========================================"
echo ""
echo "API Server: http://localhost:8000"
echo "Frontend:   http://localhost:8000"
echo "Admin:      http://localhost:8000/admin"
echo ""
echo "Press Ctrl+C to stop"
echo ""

uvicorn saas.backend.main:app --host 0.0.0.0 --port 8000
