#!/bin/bash
set -e

echo "========================================"
echo "   Persona Studio - Full Stack"
echo "========================================"

# Config
ENGINE_PORT="${ENGINE_PORT:-6967}"
SAAS_PORT="${SAAS_PORT:-8000}"
WORKDIR="${WORKDIR:-/app}"

# Cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down..."
    if [ -n "$CADDY_PID" ] && kill -0 $CADDY_PID 2>/dev/null; then
        echo "Stopping Caddy (PID $CADDY_PID)..."
        kill $CADDY_PID 2>/dev/null
    fi
    if [ -n "$ENGINE_PID" ] && kill -0 $ENGINE_PID 2>/dev/null; then
        echo "Stopping engine (PID $ENGINE_PID)..."
        kill $ENGINE_PID 2>/dev/null
        wait $ENGINE_PID 2>/dev/null
    fi
    echo "Done."
}
trap cleanup EXIT INT TERM

# Start persona engine in background
echo "[1/3] Starting persona engine on port $ENGINE_PORT..."
cd "$WORKDIR"
python3 run_persona.py --port "$ENGINE_PORT" --skip-install &
ENGINE_PID=$!
echo "  Engine PID: $ENGINE_PID"

# Wait for engine to be ready
echo "  Waiting for engine to start..."
for i in $(seq 1 60); do
    if curl -sf "http://localhost:$ENGINE_PORT/health" > /dev/null 2>&1; then
        echo "  Engine ready!"
        break
    fi
    if ! kill -0 $ENGINE_PID 2>/dev/null; then
        echo "  ERROR: Engine process died. Check logs."
        exit 1
    fi
    if [ $i -eq 60 ]; then
        echo "  WARNING: Engine not ready after 60s, continuing anyway..."
    fi
    sleep 1
done

# Start SaaS backend in background
echo "[2/3] Starting SaaS backend on port $SAAS_PORT..."
cd "$WORKDIR"
python3 -m uvicorn saas.backend.main:app \
    --host 0.0.0.0 \
    --port "$SAAS_PORT" \
    --log-level info &
SAAS_PID=$!
echo "  SaaS PID: $SAAS_PID"

# Wait for SaaS to be ready
echo "  Waiting for SaaS backend to start..."
for i in $(seq 1 30); do
    if curl -sf "http://localhost:$SAAS_PORT/api/auth/login" > /dev/null 2>&1; then
        echo "  SaaS backend ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "  WARNING: SaaS not ready after 30s, continuing anyway..."
    fi
    sleep 1
done

# Start Caddy reverse proxy (foreground - keeps container alive)
echo "[3/3] Starting Caddy reverse proxy on ports 80/443..."
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
