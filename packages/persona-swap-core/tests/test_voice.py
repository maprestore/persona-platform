
from __future__ import annotations

import numpy as np
from persona_swap_core.engines.voice_convert import VoiceConvertEngine


def test_voice_load_unload() -> None:
    engine = VoiceConvertEngine()
    engine.load(device="cpu")
    engine.unload()


def test_convert_returns_audio() -> None:
    engine = VoiceConvertEngine()
    engine.load(device="cpu")
    audio = np.zeros(16000, dtype=np.float32)
    result = engine.convert(audio, sample_rate=16000)
    assert result.shape == (16000,)
    assert result.dtype == np.float32
    engine.unload()


def test_convert_with_target_voice() -> None:
    engine = VoiceConvertEngine()
    engine.load(device="cpu")
    audio = np.zeros(16000, dtype=np.float32)
    result = engine.convert(audio, sample_rate=16000, target_voice="default")
    assert result.shape == (16000,)
    engine.unload()


def test_transcribe_returns_string() -> None:
    engine = VoiceConvertEngine()
    engine.load(device="cpu")
    audio = np.zeros(16000, dtype=np.float32)
    result = engine.transcribe(audio, sample_rate=16000)
    assert isinstance(result, str)
    engine.unload()