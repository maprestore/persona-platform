from __future__ import annotations

import numpy as np


class CrossModalGenerator:
    def __init__(self) -> None:
        self._loaded = False

    def text_to_face(self, description: str) -> np.ndarray:
        return np.zeros((512, 512, 3), dtype=np.uint8)

    def audio_to_face(self, audio_path: str) -> np.ndarray:
        return np.zeros((512, 512, 3), dtype=np.uint8)

    def unload(self) -> None:
        self._loaded = False