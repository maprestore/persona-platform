from __future__ import annotations

import numpy as np
from shared.types import VideoFrame


class SceneComposer:
    def __init__(self) -> None:
        self._loaded = True

    def compose(
        self,
        frames: list[VideoFrame],
        background: VideoFrame | None = None,
        layout: str = "stack",
    ) -> VideoFrame:
        if not frames:
            if background:
                return background
            return VideoFrame(image=np.zeros((480, 640, 3), dtype=np.uint8))

        if len(frames) == 1:
            return frames[0]

        if layout == "stack":
            return self._stack_vertical(frames)
        elif layout == "grid":
            return self._grid_layout(frames)
        elif layout == "side_by_side":
            return self._side_by_side(frames)
        else:
            return self._stack_vertical(frames)

    def _stack_vertical(self, frames: list[VideoFrame]) -> VideoFrame:
        max_w = max(f.image.shape[1] for f in frames)
        resized = []
        for f in frames:
            img = f.image
            if img.shape[1] != max_w:
                try:
                    import cv2
                    scale = max_w / img.shape[1]
                    new_h = int(img.shape[0] * scale)
                    img = cv2.resize(img, (max_w, new_h))
                except ImportError:
                    pass
            resized.append(img)
        result = np.vstack(resized)
        return VideoFrame(image=result)

    def _grid_layout(self, frames: list[VideoFrame]) -> VideoFrame:
        n = len(frames)
        cols = int(np.ceil(np.sqrt(n)))
        rows = int(np.ceil(n / cols))

        max_h = max(f.image.shape[0] for f in frames)
        max_w = max(f.image.shape[1] for f in frames)

        grid = np.zeros((rows * max_h, cols * max_w, 3), dtype=np.uint8)

        for idx, f in enumerate(frames):
            r, c = divmod(idx, cols)
            img = f.image
            h, w = img.shape[:2]
            grid[r * max_h : r * max_h + h, c * max_w : c * max_w + w] = img

        return VideoFrame(image=grid)

    def _side_by_side(self, frames: list[VideoFrame]) -> VideoFrame:
        max_h = max(f.image.shape[0] for f in frames)
        resized = []
        for f in frames:
            img = f.image
            if img.shape[0] != max_h:
                try:
                    import cv2
                    scale = max_h / img.shape[0]
                    new_w = int(img.shape[1] * scale)
                    img = cv2.resize(img, (new_w, max_h))
                except ImportError:
                    pass
            resized.append(img)
        result = np.hstack(resized)
        return VideoFrame(image=result)

    def composite_over(
        self,
        foreground: VideoFrame,
        background: VideoFrame,
        x: int = 0,
        y: int = 0,
    ) -> VideoFrame:
        bg = background.image.copy()
        fg = foreground.image
        fh, fw = fg.shape[:2]
        bh, bw = bg.shape[:2]

        x = max(0, min(x, bw - fw))
        y = max(0, min(y, bh - fh))

        bg[y : y + fh, x : x + fw] = fg
        return VideoFrame(image=bg)

    def unload(self) -> None:
        self._loaded = False
