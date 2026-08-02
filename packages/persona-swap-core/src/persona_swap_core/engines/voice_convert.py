
from __future__ import annotations

import logging
import numpy as np
import numpy.typing as npt

logger = logging.getLogger(__name__)


class VoiceConvertEngine:
    def __init__(self) -> None:
        self._model = None
        self._device = "cpu"
        self._crepe_model = None
        self._whisper_model = None
        self._load_error: str | None = None

    def load(self, device: str = "cuda") -> None:
        self._device = device
        self._load_error = None
        self._whisper_model = None
        try:
            import torch
            try:
                import torchcrepe
                self._crepe_model = True
            except ImportError:
                pass
        except ImportError:
            pass
        try:
            import whisper
            self._whisper_model = whisper.load_model("base", device=self._device)
        except ImportError as exc:
            self._load_error = str(exc) or "optional voice dependencies are missing"

    @property
    def available(self) -> bool:
        return self._crepe_model is not None or self._whisper_model is not None

    @property
    def load_error(self) -> str | None:
        return self._load_error

    def convert(
        self,
        audio: npt.NDArray[np.float32],
        sample_rate: int = 16000,
        target_voice: str | None = None,
    ) -> npt.NDArray[np.float32]:
        if target_voice is not None:
            return self._convert_to_target(audio, sample_rate, target_voice)
        shifted = self._pitch_shift(audio, sample_rate, semitones=2)
        return shifted

    def _convert_to_target(
        self,
        audio: npt.NDArray[np.float32],
        sample_rate: int,
        target_voice: str,
    ) -> npt.NDArray[np.float32]:
        semitones = (hash(target_voice) % 13) - 6
        if semitones == 0:
            semitones = 2
        return self._pitch_shift(audio, sample_rate, semitones=float(semitones))

    def _estimate_pitch(
        self, audio: npt.NDArray[np.float32], sample_rate: int
    ) -> float:
        try:
            import librosa
            f0, _, _ = librosa.pyin(
                audio.astype(np.float32),
                fmin=librosa.note_to_hz("C2"),
                fmax=librosa.note_to_hz("C7"),
                sr=sample_rate,
            )
            f0_clean = f0[~np.isnan(f0)]
            if len(f0_clean) > 0:
                return float(np.mean(f0_clean))
            return 0.0
        except ImportError:
            n = len(audio)
            if n < 2:
                return 0.0
            spectrum = np.abs(np.fft.rfft(audio))
            freqs = np.fft.rfftfreq(n, 1.0 / sample_rate)
            peak_idx = np.argmax(spectrum[1:]) + 1 if len(spectrum) > 1 else 0
            if peak_idx < len(freqs):
                return float(freqs[peak_idx])
            return 0.0

    def _apply_pitch_shift(
        self,
        audio: npt.NDArray[np.float32],
        sample_rate: int,
        semitones: float,
    ) -> npt.NDArray[np.float32]:
        try:
            import librosa
            return librosa.effects.pitch_shift(
                audio.astype(np.float32), sr=sample_rate, n_steps=semitones
            )
        except ImportError:
            factor = 2 ** (semitones / 12.0)
            new_len = int(len(audio) / factor)
            indices = np.linspace(0, len(audio) - 1, new_len)
            shifted = np.interp(indices, np.arange(len(audio)), audio).astype(np.float32)
            if len(shifted) > len(audio):
                shifted = shifted[:len(audio)]
            elif len(shifted) < len(audio):
                shifted = np.pad(shifted, (0, len(audio) - len(shifted)))
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
        if len(audio) == 0:
            return audio.astype(np.float32)
        factor = 2 ** (semitones / 12.0)
        new_len = max(1, int(len(audio) / factor))
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
        if self._whisper_model is None:
            return ""
        audio_float = audio.astype(np.float32)
        result = self._whisper_model.transcribe(audio_float, fp16=self._device == "cuda")
        return result["text"]

    def unload(self) -> None:
        self._model = None
        self._crepe_model = None
        self._whisper_model = None
