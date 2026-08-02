PYTHON ?= python3
PIP ?= $(PYTHON) -m pip

.PHONY: test lint typecheck install-all install

test:
	$(PYTHON) -m pytest -q

lint:
	ruff check packages/ example/

typecheck:
	pyright packages/ example/

install:
	$(PIP) install -e packages/shared
	$(PIP) install -e packages/persona-swap-core
	$(PIP) install -e packages/magiclip
	$(PIP) install -e packages/sdk
	$(PIP) install -e packages/no-code-pipeline

install-all: install
	$(PIP) install -e "packages/persona-swap-core[all]"
	$(PIP) install -e "packages/sdk[all]"
	$(PIP) install -e "packages/no-code-pipeline[all]"
	-$(PIP) install pyvirtualcam 2>/dev/null || true
