from __future__ import annotations

from cross_modal import CrossModalGenerator


def test_text_to_face_shape() -> None:
    gen = CrossModalGenerator()
    result = gen.text_to_face("a person with glasses")
    assert result.shape == (512, 512, 3)


def test_audio_to_face_shape() -> None:
    gen = CrossModalGenerator()
    result = gen.audio_to_face("test.wav")
    assert result.shape == (512, 512, 3)