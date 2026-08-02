#!/bin/bash
DIR="/data/data/com.termux/files/home/persona-platform"

# Kill existing
pkill -f "uvicorn main:app" 2>/dev/null
pkill -f "vite" 2>/dev/null
sleep 1

# Start backend
cd "$DIR/saas/backend"
nohup python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 &>/data/data/com.termux/files/usr/tmp/backend.log &

# Start frontend
cd "$DIR/saas/frontend"
nohup node ./node_modules/vite/bin/vite.js --host 0.0.0.0 --port 3000 &>/data/data/com.termux/files/usr/tmp/frontend.log &

sleep 3
echo "Backend:  http://localhost:8000"
echo "Frontend: http://localhost:3000"
echo "API Docs: http://localhost:8000/docs"
