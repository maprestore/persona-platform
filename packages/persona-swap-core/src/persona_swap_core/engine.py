from shared.types import SwapEngine, VideoFrame


class PersonaSwapCore(SwapEngine):
    def __init__(self) -> None:
        self._loaded = False

    def load(self, device: str = "cuda") -> None:
        self._loaded = True

    def swap(self, source: VideoFrame, target: VideoFrame) -> VideoFrame:
        return target

    def unload(self) -> None:
        self._loaded = False


__all__ = ["PersonaSwapCore"]