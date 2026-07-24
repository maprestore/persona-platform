from __future__ import annotations

import numpy as np
from video_animate import VideoAnimator


def test_animator_load_unload() -> None:
    anim = VideoAnimator()
    anim.load("test_avatar.png")
    anim.unload()


def test_drive_returns_frame() -> None:
    from shared.types import VideoFrame
    anim = VideoAnimator()
    anim.load("test_avatar.png")
    frame = VideoFrame(image=np.zeros((480, 640, 3), dtype=np.uint8))
    result = anim.drive(frame)
    assert result.image.shape == (480, 640, 3)
    anim.unload()