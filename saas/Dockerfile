FROM nvidia/cuda:12.4.0-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV NVIDIA_VISIBLE_DEVICES=all
ENV CUDA_VISIBLE_DEVICES=0

RUN apt-get update && apt-get install -y \
    python3.10 python3-pip python3.10-venv \
    git ffmpeg libgl1 libglib2.0-0 curl \
    openssh-server \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV PYTHONPATH="/app/saas/backend:/app/packages/shared/src:/app/packages/persona-swap-core/src:/app/packages/sdk/src:/app/packages/magiclip/src:${PYTHONPATH}"

COPY saas/backend/requirements.txt /app/saas/backend/requirements.txt
COPY pyproject.toml Makefile /app/

RUN pip install --upgrade pip && \
    pip install setuptools wheel && \
    pip install -r /app/saas/backend/requirements.txt

COPY packages/ packages/

RUN pip install packages/shared && \
    pip install --no-deps packages/persona-swap-core && \
    pip install --no-deps packages/magiclip && \
    pip install --no-deps packages/sdk

RUN pip uninstall -y torch torchvision 2>/dev/null; \
    pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124

COPY saas/ saas/

RUN cd saas/frontend && \
    npm install && \
    npm run build

ENV PYTHONPATH="/app/saas/backend:${PYTHONPATH}"
RUN python3 -c "from models import init_db, seed_default_data; init_db(); seed_default_data()"

RUN mkdir -p /app/uploads /app/data

COPY start-all.sh /app/start-all.sh
RUN chmod +x /app/start-all.sh

EXPOSE 8000 6967 22 9999

ENV PERSONA_ENGINE_URL=http://localhost:6967
ENV PERSONA_DEVICE=cuda

CMD ["/app/start-all.sh"]
