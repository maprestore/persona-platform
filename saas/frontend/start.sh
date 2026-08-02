#!/bin/bash
echo "Starting Persona Studio..."
echo "Local:   http://localhost:3000"
echo "Network: http://$(ip route get 1 2>/dev/null | awk '{print $7; exit}'):3000"
echo ""
echo "Press Ctrl+C to stop"
echo ""
node node_modules/vite/bin/vite.js --host 0.0.0.0 --port 3000
