#!/bin/bash
set -e

# Persona Studio - Docker Build & Push Script
# Usage: ./docker-build.sh [your-dockerhub-username] [tag]

DOCKERHUB="${1:-personastudio}"
TAG="${2:-latest}"
IMAGE="$DOCKERHUB/persona-studio:$TAG"

echo "========================================"
echo "   Building Persona Studio Docker Image"
echo "========================================"
echo ""
echo "Image: $IMAGE"
echo ""

# Build from project root
cd "$(dirname "$0")"

echo "[1/2] Building Docker image..."
docker build -t "$IMAGE" -f saas/Dockerfile .

echo ""
echo "[2/2] Pushing to Docker Hub..."
docker push "$IMAGE"

echo ""
echo "========================================"
echo "   Done!"
echo "========================================"
echo ""
echo "Image pushed: $IMAGE"
echo ""
echo "To deploy on Vast.ai:"
echo "  1. Go to https://cloud.vast.ai"
echo "  2. Search for an RTX 4090 instance"
echo "  3. Use Docker Image: $IMAGE"
echo "  4. Expose ports: 8000 (SaaS) + 6967 (Engine)"
echo "  5. Set env: JWT_SECRET=<your-secret>"
echo ""
echo "Or use the admin panel:"
echo "  http://<your-server>:8000/admin/vast"
echo ""
