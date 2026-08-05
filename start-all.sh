#!/bin/bash
set -e

echo "========================================"
echo "   Persona Studio - Full Stack"
echo "========================================"

ENGINE_PORT="${ENGINE_PORT:-6967}"
SAAS_PORT="${SAAS_PORT:-8000}"
WORKDIR="${WORKDIR:-/app}"

cleanup() {
    echo ""
    echo "Shutting down..."
    if [ -n "$ENGINE_PID" ] && kill -0 $ENGINE_PID 2>/dev/null; then
        echo "Stopping engine (PID $ENGINE_PID)..."
        kill $ENGINE_PID 2>/dev/null
        wait $ENGINE_PID 2>/dev/null
    fi
    echo "Done."
}
trap cleanup EXIT INT TERM

echo "[1/2] Starting persona engine on port $ENGINE_PORT..."
cd "$WORKDIR"
python3 run_persona.py --port "$ENGINE_PORT" --skip-install &
ENGINE_PID=$!
echo "  Engine PID: $ENGINE_PID"

echo "  Waiting for engine to start..."
for i in $(seq 1 180); do
    if curl -sf "http://localhost:$ENGINE_PORT/health" > /dev/null 2>&1; then
        echo "  Engine ready!"
        break
    fi
    if ! kill -0 $ENGINE_PID 2>/dev/null; then
        echo "  WARNING: Engine process ended. Continuing with SaaS backend only."
        ENGINE_PID=""
        break
    fi
    if [ $i -eq 180 ]; then
        echo "  WARNING: Engine not ready after 180s, continuing anyway..."
    fi
    sleep 1
done

echo "[2/2] Starting SaaS backend on port $SAAS_PORT..."
cd "$WORKDIR"
EXEC_PID=$!
python3 -m uvicorn saas.backend.main:app \
    --host 0.0.0.0 \
    --port "$SAAS_PORT" \
    --log-level info &
SAAS_PID=$!
echo "  SaaS PID: $SAAS_PID"

echo "  Waiting for SaaS backend to start..."
for i in $(seq 1 60); do
    if curl -sf "http://localhost:$SAAS_PORT/api/auth/login" > /dev/null 2>&1; then
        echo "  SaaS backend ready!"
        break
    fi
    if [ $i -eq 60 ]; then
        echo "  WARNING: SaaS not ready after 60s"
    fi
    sleep 2
done

echo "========================================"
echo "All services started!"
echo "Frontend: http://$(curl -s ifconfig.me):$SAAS_PORT"
echo "Engine:   http://$(curl -s ifconfig.me):$ENGINE_PORT"
echo "========================================"

wait $SAAS_PID $ENGINE_PID 2>/dev/null || wait $SAAS_PID
