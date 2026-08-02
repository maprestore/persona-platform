# Persona Platform full refactor

This release converts silent failures into explicit errors or clearly logged, documented fallbacks.

## Included

- Feature health is exposed through `/health` and `/features`; missing ML models return HTTP 503 instead of fake success.
- Media readers and writers validate open state, frame counts, write results, and output files.
- WebSocket and MJPEG streams report invalid frames, disconnects, and repeated capture failures.
- Uploads are bounded, extension-validated, and path-safe.
- Voice conversion, cloning, translation, and source-face loading now have model preflights and explicit unknown-target errors.
- Pipeline graphs reject unknown edges, duplicate/self edges, cycles, missing inputs, and unsupported data.
- React panels surface upload, processing, camera, filter, voice, translation, and tuning errors in the UI.
- Launchers fail fast on bad source paths, use the correct CLI module, and do not hide optional dependency install failures.
- CI installs the actual editable packages and runs `python -m pytest -q`; no fake `make` or root extras path remains.
- Added regression tests for pipeline validation, storage traversal, and failed output writes.

## Verification

- Python AST validation: passed for all Python files.
- Python bytecode compilation: passed.
- Bash syntax validation: passed.
- Static API, CI, pipeline, and frontend error-state checks: passed.
- Full runtime tests require the project dependencies and were not executable in the build sandbox because FastAPI/httpx/pytest were unavailable there.
