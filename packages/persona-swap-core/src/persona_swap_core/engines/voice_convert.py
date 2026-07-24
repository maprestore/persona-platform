from __future__ import annotations

import numpy as np
import numpy.typing as npt


class VoiceConvertEngine:
    def __init__(self) -> None:
        self._model = None
        self._device = "cpu"

    def load(self, device: str = "cuda") -> None:
        self._device = device
        try:
            import torch
        except ImportError:
            msg = "torch not installed. Run: pip install torch"
            raise RuntimeError(msg) from None

    def convert(
        self,
        audio: npt.NDArray[np.float32],
        sample_rate: int = 16000,
        target_voice: str | None = None,
    ) -> npt.NDArray[np.float32]:
        return audio

    def transcribe(
        self, audio: npt.NDArray[np.float32], sample_rate: int = 16000
    ) -> str:
        try:
            import whisper
            model = whisper.load_model("base", device=self._device)
            audio_float = audio.astype(np.float32)
            result = model.transcribe(audio_float, fp16=self._device == "cuda")
            return result["text"]
        except ImportError:
            return ""

    def unload(self) -> None:
        self._model = None