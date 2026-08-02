
from __future__ import annotations

from enum import Enum


class Backend(Enum):
    ONNX = "onnx"
    TENSORRT = "tensorrt"
    COREML = "coreml"
    TORCHSCRIPT = "torchscript"


class EngineOptimizer:
    def __init__(self) -> None:
        self._backends: dict[str, Backend] = {}

    def detect_best_backend(self) -> Backend:
        try:
            import torch
            if torch.cuda.is_available():
                return Backend.TENSORRT
            if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                return Backend.COREML
            return Backend.TORCHSCRIPT
        except ImportError:
            return Backend.ONNX

    def optimize(self, model_path: str, backend: Backend | None = None) -> str:
        target = backend or self.detect_best_backend()
        return f"{model_path}.{target.value}"