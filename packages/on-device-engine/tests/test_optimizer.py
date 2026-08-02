
from __future__ import annotations

from on_device_engine import EngineOptimizer, Backend


def test_detect_best_backend() -> None:
    opt = EngineOptimizer()
    backend = opt.detect_best_backend()
    assert isinstance(backend, Backend)


def test_optimize_returns_path() -> None:
    opt = EngineOptimizer()
    result = opt.optimize("model.onnx", Backend.ONNX)
    assert result.endswith(".onnx")