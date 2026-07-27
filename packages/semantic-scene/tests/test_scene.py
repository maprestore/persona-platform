from __future__ import annotations

import numpy as np
from semantic_scene import SemanticSceneEngine
from shared.types import VideoFrame


def test_analyze_returns_dict() -> None:
    engine = SemanticSceneEngine()
    frame = VideoFrame(image=np.zeros((100, 100, 3), dtype=np.uint8))
    result = engine.analyze(frame)
    assert "scene_type" in result
    assert result["scene_type"] == "dark_night"


def test_relight_returns_frame() -> None:
    engine = SemanticSceneEngine()
    frame = VideoFrame(image=np.zeros((100, 100, 3), dtype=np.uint8))
    result = engine.relight(frame)
    assert result.image.shape == (100, 100, 3)