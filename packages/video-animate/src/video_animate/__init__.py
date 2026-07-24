from __future__ import annotations

import numpy as np
from shared.types import VideoFrame, BodyPose


class VideoAnimator:
    def __init__(self) -> None:
        self._loaded = False

    def load(self, avatar_path: str) -> None:
        self._loaded = True

    def drive(self, frame: VideoFrame) -> VideoFrame:
        return frame

    def unload(self) -> None:
        self._loaded = False