FROM nvidia/cuda:12.4.0-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV NVIDIA_VISIBLE_DEVICES=all
ENV CUDA_VISIBLE_DEVICES=0

# Install system dependencies (Python + Node.js + Caddy)
RUN apt-get update && apt-get install -y \
    python3.10 python3-pip python3.10-venv \
    git ffmpeg libgl1 libglib2.0-0 curl \
    debian-keyring debian-archive-keyring apt-transport-https \
    && curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg \
    && curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list \
    && apt-get update \
    && apt-get install -y caddy \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Set Python path for imports
ENV PYTHONPATH="/app/saas/backend:/app/packages/shared/src:/app/packages/persona-swap-core/src:/app/packages/sdk/src:/app/packages/magiclip/src:${PYTHONPATH}"

# Copy requirements first for layer caching
COPY saas/backend/requirements.txt /app/saas/backend/requirements.txt
COPY pyproject.toml Makefile /app/

# Install Python dependencies (SaaS + engine)
RUN pip install --upgrade pip && \
    pip install setuptools wheel && \
    pip install -r /app/saas/backend/requirements.txt

# Copy packages
COPY packages/ packages/

# Install persona-platform packages (engine + SDK)
# Use --no-deps to avoid file:// URI resolution issues, then install transitive deps separately
RUN pip install packages/shared && \
    pip install --no-deps packages/persona-swap-core && \
    pip install --no-deps packages/magiclip && \
    pip install --no-deps packages/sdk && \
    pip install \
        opencv-python pillow librosa scipy \
        fastapi uvicorn websockets python-multipart httpx \
        insightface onnxruntime-gpu \
        gfpgan mediapipe rembg \
        pydub torchcrepe whisper soundfile \
        pyvirtualcam numpy typing-extensions \
        imageio imageio-ffmpeg \
        scikit-image filterpy

# Install PyTorch with CUDA support
RUN pip uninstall -y torch torchvision 2>/dev/null; \
    pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124

# Copy SaaS backend and frontend
COPY saas/ saas/

# Build frontend
RUN cd saas/frontend && \
    npm install && \
    npm run build

# Initialize database and create admin
ENV PYTHONPATH="/app/saas/backend:${PYTHONPATH}"
RUN python3 -c "from models import init_db, seed_default_data; init_db(); seed_default_data()"

# Create necessary directories
RUN mkdir -p /app/uploads /app/data /etc/caddy

# Copy entrypoint
COPY start-all.sh /app/start-all.sh
RUN chmod +x /app/start-all.sh

# Copy Caddyfile
COPY saas/Caddyfile /etc/caddy/Caddyfile

# Expose ports: HTTPS (443) + HTTP (80) + Engine (6967)
EXPOSE 80 443 6967

# Health check on the SaaS API
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -sf http://localhost:8000/api/auth/login || exit 1

# Default environment
ENV PERSONA_ENGINE_URL=http://localhost:6967
ENV PERSONA_DEVICE=cuda
ENV DOMAIN=*

# Run Caddy + both engine + backend
CMD ["/app/start-all.sh"]
