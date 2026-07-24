SHELL := /bin/bash
PYTHON := python3

.PHONY: install install-all lint typecheck test clean serve docker

install:
	$(PYTHON) -m pip install -e packages/shared
	$(PYTHON) -m pip install -e packages/persona-swap-core
	$(PYTHON) -m pip install -e packages/on-device-engine
	$(PYTHON) -m pip install -e packages/sdk
	$(PYTHON) -m pip install -e packages/no-code-pipeline

install-all:
	$(PYTHON) -m pip install -e packages/shared
	$(PYTHON) -m pip install -e packages/persona-swap-core[all]
	$(PYTHON) -m pip install -e packages/video-animate[all] 2>/dev/null || true
	$(PYTHON) -m pip install -e packages/scene-composer[all] 2>/dev/null || true
	$(PYTHON) -m pip install -e packages/semantic-scene[all] 2>/dev/null || true
	$(PYTHON) -m pip install -e packages/cross-modal[all] 2>/dev/null || true
	$(PYTHON) -m pip install -e packages/on-device-engine[all] 2>/dev/null || true
	$(PYTHON) -m pip install -e packages/sdk[all]
	$(PYTHON) -m pip install -e packages/no-code-pipeline[all]

lint:
	ruff check packages/ example/

typecheck:
	pyright packages/ example/ 2>/dev/null || true

test:
	python3 -m pytest packages/ -v --tb=short --timeout=60

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name node_modules -prune -exec rm -rf {} + 2>/dev/null || true

serve:
	persona serve --port 6967 --host 0.0.0.0

docker:
	docker build -t persona-platform:latest -f docker/Dockerfile .
