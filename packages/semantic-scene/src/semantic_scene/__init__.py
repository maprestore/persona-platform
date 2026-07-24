from __future__ import annotations

from shared.types import VideoFrame


class SemanticSceneEngine:
    def __init__(self) -> None:
        self._loaded = False

    def analyze(self, frame: VideoFrame) -> dict:
        return {"scene_type": "unknown", "depth_map": None}

    def relight(self, frame: VideoFrame, scene_params: dict | None = None) -> VideoFrame:
        return frame

    def unload(self) -> None:
        self._loaded = False