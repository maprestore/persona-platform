from __future__ import annotations

from shared.types import VideoFrame


class SceneComposer:
    def __init__(self) -> None:
        self._loaded = False

    def compose(self, frames: list[VideoFrame], background: VideoFrame | None = None) -> VideoFrame:
        if not frames:
            return background or VideoFrame(image=np.zeros((480, 640, 3), dtype=np.uint8))
        return frames[0]

    def unload(self) -> None:
        self._loaded = False