from __future__ import annotations

import numpy as np
import numpy.typing as npt


class VoiceConvertEngine:
    def __init__(self) -> None:
        self._model = None
        self._device = "cpu"
        self._crepe_model = None
        self._samples: dict[str, npt.NDArray[np.float32]] = {}
        self._sample_rates: dict[str, int] = {}

    def load(self, device: str = "cuda") -> None:
        self._device = device
        try:
            import torch
            try:
                import torchcrepe
                self._crepe_model = True
            except ImportError:
                pass
        except ImportError:
            pass

    def convert(
        self,
        audio: npt.NDArray[np.float32],
        sample_rate: int = 16000,
        target_voice: str | None = None,
    ) -> npt.NDArray[np.float32]:
        shifted = self._pitch_shift(audio, sample_rate, semitones=2)
        return shifted

    def _pitch_shift(
        self,
        audio: npt.NDArray[np.float32],
        sample_rate: int,
        semitones: float = 2.0,
    ) -> npt.NDArray[np.float32]:
        if self._crepe_model:
            return self._crepe_shift(audio, sample_rate, semitones)
        return self._resample_shift(audio, sample_rate, semitones)

    def _resample_shift(
        self,
        audio: npt.NDArray[np.float32],
        sample_rate: int,
        semitones: float,
    ) -> npt.NDArray[np.float32]:
        factor = 2 ** (semitones / 12.0)
        new_len = int(len(audio) / factor)
        indices = np.linspace(0, len(audio) - 1, new_len)
        shifted = np.interp(indices, np.arange(len(audio)), audio).astype(np.float32)

        if len(shifted) > len(audio):
            shifted = shifted[: len(audio)]
        elif len(shifted) < len(audio):
            shifted = np.pad(shifted, (0, len(audio) - len(shifted)))

        return shifted

    def _crepe_shift(
        self,
        audio: npt.NDArray[np.float32],
        sample_rate: int,
        semitones: float,
    ) -> npt.NDArray[np.float32]:
        try:
            import torch
            import torchcrepe

            audio_tensor = torch.from_numpy(audio).float()
            if audio_tensor.dim() == 1:
                audio_tensor = audio_tensor.unsqueeze(0)

            pitch, _ = torchcrepe.predict(
                audio_tensor,
                sample_rate,
                16000,
                512,
                torch.device(self._device),
                return_periodicity=False,
            )

            shift_factor = 2 ** (semitones / 12.0)
            pitch = pitch * shift_factor

            new_audio = torchcrepe.convert.units_to_audio(
                pitch,
                sample_rate,
                16000,
                512,
                torch.device(self._device),
            )
            result = new_audio.squeeze().cpu().numpy().astype(np.float32)

            if len(result) > len(audio):
                result = result[: len(audio)]
            elif len(result) < len(audio):
                result = np.pad(result, (0, len(audio) - len(result)))

            return result
        except Exception:
            return self._resample_shift(audio, sample_rate, semitones)

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
        self._crepe_model = None
        self._samples.clear()
        self._sample_rates.clear()
