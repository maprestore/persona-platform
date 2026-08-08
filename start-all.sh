#!/bin/bash

echo "========================================"
echo "   Persona Studio - Full Stack"
echo "========================================"

ENGINE_PORT="${ENGINE_PORT:-6967}"
SAAS_PORT="${SAAS_PORT:-80}"
WORKDIR="${WORKDIR:-/app}"
LOG="/app/logs/startup.log"
ENGINE_LOG="/app/logs/engine.log"

mkdir -p /app/logs

ENGINE_PID=""
SAAS_PID=""
LOG_PID=""
TUNNEL_PID=""
ENGINE_MONITOR_PID=""

# Start Cloudflare Tunnel if configured
if [ -n "$CF_TUNNEL_TOKEN" ]; then
    cloudflared tunnel run --token "$CF_TUNNEL_TOKEN" >> "$LOG" 2>&1 &
    TUNNEL_PID=$!
    echo "  Tunneling via Cloudflare Tunnel (PID: $TUNNEL_PID)"
elif [ -f /root/.cloudflared/token ]; then
    cloudflared tunnel run --token "$(cat /root/.cloudflared/token)" >> "$LOG" 2>&1 &
    TUNNEL_PID=$!
    echo "  Tunneling via Cloudflare Tunnel (PID: $TUNNEL_PID)"
fi

# Start SSH daemon for remote access
echo "[0/5] Starting SSH daemon..."
mkdir -p /root/.ssh /run/sshd
if [ -n "$SSH_PUBKEY" ]; then
    echo "$SSH_PUBKEY" >> /root/.ssh/authorized_keys
    chmod 700 /root/.ssh
    chmod 600 /root/.ssh/authorized_keys
    echo "  SSH key added to authorized_keys"
fi
/usr/sbin/sshd 2>/dev/null || echo "  WARNING: sshd not available, skipping"

cleanup() {
    echo ""
    echo "Shutting down..."
    [ -n "$ENGINE_MONITOR_PID" ] && kill $ENGINE_MONITOR_PID 2>/dev/null
    [ -n "$ENGINE_PID" ] && kill $ENGINE_PID 2>/dev/null
    [ -n "$SAAS_PID" ] && kill $SAAS_PID 2>/dev/null
    [ -n "$LOG_PID" ] && kill $LOG_PID 2>/dev/null
    [ -n "$TUNNEL_PID" ] && kill $TUNNEL_PID 2>/dev/null
    echo "Done."
}
trap cleanup EXIT INT TERM

start_engine() {
    echo "  Starting persona engine on port $ENGINE_PORT..."
    cd "$WORKDIR"
    python3 run_persona.py --port "$ENGINE_PORT" --skip-install >> "$ENGINE_LOG" 2>&1 &
    ENGINE_PID=$!
    echo "  Engine PID: $ENGINE_PID"

    echo "  Waiting for engine to start..."
    for i in $(seq 1 120); do
        if curl -sf "http://localhost:$ENGINE_PORT/health" > /dev/null 2>&1; then
            echo "  Engine ready!"
            return 0
        fi
        if ! kill -0 $ENGINE_PID 2>/dev/null; then
            echo "  WARNING: Engine process died on startup (attempt $i)"
            return 1
        fi
        sleep 1
    done
    echo "  WARNING: Engine not ready after 120s"
    return 1
}

# Auto-restart engine if it crashes
engine_monitor() {
    while true; do
        sleep 30
        if ! curl -sf "http://localhost:$ENGINE_PORT/health" > /dev/null 2>&1; then
            echo "[$(date)] Engine health check failed, restarting..." >> "$LOG"
            if [ -n "$ENGINE_PID" ] && kill -0 $ENGINE_PID 2>/dev/null; then
                kill $ENGINE_PID 2>/dev/null
                sleep 2
            fi
            start_engine
            echo "[$(date)] Engine restarted (PID: $ENGINE_PID)" >> "$LOG"
        fi
    done
}

echo "[1/5] Starting persona engine..."
if ! start_engine; then
    echo "  Retrying engine start in 5s..."
    sleep 5
    start_engine || echo "  WARNING: Engine failed to start, continuing with SaaS only"
fi

# Start engine monitor in background
engine_monitor &
ENGINE_MONITOR_PID=$!
echo "  Engine monitor PID: $ENGINE_MONITOR_PID"

echo "[2/5] Starting SaaS backend on port $SAAS_PORT..."
cd "$WORKDIR"
PYTHONPATH="/app/saas/backend:${PYTHONPATH}" python3 -m uvicorn saas.backend.main:app \
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

echo "[3/5] Starting log server on port 9999..."
cd /app/logs
python3 -m http.server 9999 >> "$LOG" 2>&1 &
LOG_PID=$!
echo "  Log server PID: $LOG_PID"

echo "[4/5] Writing startup marker..."
echo "$(date -Iseconds)" > /app/logs/.started

echo "[5/5] Keeping container alive..."
echo "========================================"
echo "Services:"
echo "  Frontend: http://$(curl -s ifconfig.me)"
echo "  Engine:   http://$(curl -s ifconfig.me):$ENGINE_PORT"
echo "  Logs:     http://$(curl -s ifconfig.me):9999/startup.log"
echo "  SSH:      via Vast.ai gateway"
echo "========================================"

wait $SAAS_PID $ENGINE_PID $LOG_PID $TUNNEL_PID $ENGINE_MONITOR_PID 2>/dev/null
echo "All processes exited. Container stopping."
