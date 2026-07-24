from __future__ import annotations

import numpy as np
import numpy.typing as npt
from shared.types import VideoFrame


class VirtualCamera:
    def __init__(self, name: str = "Persona Camera", width: int = 1280, height: int = 720, fps: int = 30):
        self.name = name
        self.width = width
        self.height = height
        self.fps = fps
        self._cam = None

    def start(self) -> None:
        try:
            import pyvirtualcam
            self._cam = pyvirtualcam.Camera(
                name=self.name,
                width=self.width,
                height=self.height,
                fps=self.fps,
            )
        except ImportError:
            pass

    def send(self, frame: VideoFrame) -> None:
        if self._cam is None:
            return
        resized = frame.image
        if resized.shape[1] != self.width or resized.shape[0] != self.height:
            import cv2
            resized = cv2.resize(resized, (self.width, self.height))
        self._cam.send(resized)

    def stop(self) -> None:
        if self._cam is not None:
            self._cam.close()