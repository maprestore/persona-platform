FROM nvidia/cuda:12.4.0-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    python3.10 python3-pip git ffmpeg libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY packages/ packages/
COPY pyproject.toml Makefile ./

RUN pip install --upgrade pip && \
    pip install setuptools wheel && \
    make install-all

RUN pip uninstall -y torch torchvision && \
    pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124

EXPOSE 6967

CMD ["persona", "serve"]