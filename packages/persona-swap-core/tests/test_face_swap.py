from __future__ import annotations

import numpy as np
from persona_swap_core.engines.face_swap import FaceSwapEngine


def test_face_engine_load_unload() -> None:
    engine = FaceSwapEngine()
    engine.load(device="cpu")
    engine.unload()


def test_face_detect_empty_without_model() -> None:
    engine = FaceSwapEngine()
    img = np.zeros((100, 100, 3), dtype=np.uint8)
    result = engine.detect(img)
    assert result == []


def test_swap_returns_image() -> None:
    engine = FaceSwapEngine()
    source = np.zeros((100, 100, 3), dtype=np.uint8)
    target = np.ones((100, 100, 3), dtype=np.uint8) * 255
    result = engine.swap(source, target)
    assert result.shape == (100, 100, 3)
    assert result.dtype == np.uint8


def test_enhance_returns_image() -> None:
    engine = FaceSwapEngine()
    img = np.zeros((100, 100, 3), dtype=np.uint8)
    result = engine.enhance(img)
    assert result.shape == (100, 100, 3)


def test_swap_with_source_faces() -> None:
    engine = FaceSwapEngine()
    source = np.zeros((100, 100, 3), dtype=np.uint8)
    target = np.ones((100, 100, 3), dtype=np.uint8) * 255
    result = engine.swap(source, target, source_faces=[])
    assert result.shape == (100, 100, 3)
    assert np.all(result == target)