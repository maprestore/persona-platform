from __future__ import annotations

import numpy as np
import numpy.typing as npt
from dataclasses import dataclass, field
from enum import Enum
from typing import Protocol


class DeviceType(Enum):
    CPU = "cpu"
    CUDA = "cuda"
    MPS = "mps"
    NPU = "npu"


@dataclass
class FaceDetection:
    bbox: list[float]
    landmarks: list[list[float]]
    confidence: float
    embedding: npt.NDArray[np.float32] | None = None


@dataclass
class BodyPose:
    keypoints: list[list[float]]
    scores: list[float]


@dataclass
class AudioFrame:
    samples: npt.NDArray[np.float32]
    sample_rate: int = 16000


@dataclass
class VideoFrame:
    image: npt.NDArray[np.uint8]
    timestamp: float = 0.0
    faces: list[FaceDetection] = field(default_factory=list)
    pose: BodyPose | None = None


class SwapEngine(Protocol):
    def load(self, device: str = "cuda") -> None: ...
    def swap(self, source: VideoFrame, target: VideoFrame) -> VideoFrame: ...
    def unload(self) -> None: ...


class VoiceEngine(Protocol):
    def load(self, device: str = "cuda") -> None: ...
    def convert(self, audio: AudioFrame, target_voice: str) -> AudioFrame: ...
    def unload(self) -> None: ...