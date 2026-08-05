#!/bin/bash
mkdir -p /app/logs

# Run start-all.sh but capture all output
/app/start-all.sh > /app/logs/startup.log 2>&1 &

sleep 30

# Start a simple HTTP server to serve logs
cd /app/logs
python3 -m http.server 80 &

# Keep container alive
wait
