#!/bin/bash
set -e

echo "========================================"
echo "   Persona Studio - Full Stack"
echo "========================================"

ENGINE_PORT="${ENGINE_PORT:-6967}"
SAAS_PORT="${SAAS_PORT:-8000}"
WORKDIR="${WORKDIR:-/app}"
LOG="/app/logs/startup.log"

mkdir -p /app/logs

# Start SSH daemon for remote access
echo "[0/3] Starting SSH daemon..."
mkdir -p /run/sshd
/usr/sbin/sshd 2>/dev/null || echo "WARNING: sshd not available, skipping"

cleanup() {
    echo ""
    echo "Shutting down..."
    [ -n "$ENGINE_PID" ] && kill $ENGINE_PID 2>/dev/null
    [ -n "$SAAS_PID" ] && kill $SAAS_PID 2>/dev/null
    echo "Done."
}
trap cleanup EXIT INT TERM

echo "[1/3] Starting persona engine on port $ENGINE_PORT..."
cd "$WORKDIR"
python3 run_persona.py --port "$ENGINE_PORT" --skip-install >> "$LOG" 2>&1 &
ENGINE_PID=$!
echo "  Engine PID: $ENGINE_PID (logs: $LOG)"

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

echo "[2/3] Starting SaaS backend on port $SAAS_PORT..."
cd "$WORKDIR"
python3 -m uvicorn saas.backend.main:app \
    --host 0.0.0.0 \
    --port "$SAAS_PORT" \
    --log-level info >> "$LOG" 2>&1 &
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

echo "[3/3] Serving logs on port 9999..."
cd /app/logs
python3 -m http.server 9999 >> "$LOG" 2>&1 &
LOG_PID=$!
echo "  Log server PID: $LOG_PID"

echo "========================================"
echo "All services started!"
echo "Frontend: http://$(curl -s ifconfig.me):$SAAS_PORT"
echo "Engine:   http://$(curl -s ifconfig.me):$ENGINE_PORT"
echo "Logs:     http://$(curl -s ifconfig.me):9999/startup.log"
echo "========================================"

wait $SAAS_PID $ENGINE_PID $LOG_PID 2>/dev/null
echo "All processes exited. Container stopping."
