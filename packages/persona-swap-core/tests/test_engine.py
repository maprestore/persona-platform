from __future__ import annotations

import numpy as np
from persona_swap_core import PersonaSwapCore


def test_engine_load_unload() -> None:
    engine = PersonaSwapCore()
    engine.load(device="cpu")
    assert engine._loaded
    engine.unload()
    assert not engine._loaded


def test_swap_returns_frame() -> None:
    from shared.types import VideoFrame

    engine = PersonaSwapCore()
    engine.load(device="cpu")

    source = VideoFrame(image=np.zeros((480, 640, 3), dtype=np.uint8))
    target = VideoFrame(image=np.ones((480, 640, 3), dtype=np.uint8) * 255)
    result = engine.swap(source, target)
    assert result.image.shape == (480, 640, 3)
    assert result.image.dtype == np.uint8

    engine.unload()


def test_voice_convert_returns_audio() -> None:
    from shared.types import AudioFrame

    engine = PersonaSwapCore()
    engine.load(device="cpu")

    audio = AudioFrame(samples=np.zeros(16000, dtype=np.float32), sample_rate=16000)
    result = engine.convert_voice(audio)
    assert result.samples.shape == (16000,)
    assert result.samples.dtype == np.float32

    engine.unload()


def test_set_source_accepts_image() -> None:
    engine = PersonaSwapCore()
    engine.load(device="cpu")
    img = np.zeros((480, 640, 3), dtype=np.uint8)
    engine.set_source(img)
    engine.unload()