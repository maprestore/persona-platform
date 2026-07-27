from __future__ import annotations

import numpy as np
from scene_composer import SceneComposer
from shared.types import VideoFrame


def test_compose_empty_returns_background() -> None:
    comp = SceneComposer()
    bg = VideoFrame(image=np.zeros((100, 100, 3), dtype=np.uint8))
    result = comp.compose([], background=bg)
    assert result.image.shape == (100, 100, 3)


def test_compose_with_frames() -> None:
    comp = SceneComposer()
    frames = [
        VideoFrame(image=np.ones((100, 100, 3), dtype=np.uint8) * 128),
        VideoFrame(image=np.ones((100, 100, 3), dtype=np.uint8) * 64),
    ]
    result = comp.compose(frames)
    assert result.image.shape == (200, 100, 3)