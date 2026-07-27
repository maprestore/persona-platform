from __future__ import annotations

import numpy as np
import numpy.typing as npt


class VoiceClonerEngine:
    def __init__(self) -> None:
        self._device = "cpu"
        self._loaded = False
        self._samples: dict[str, npt.NDArray[np.float32]] = {}
        self._sample_rates: dict[str, int] = {}

    def load(self, device: str = "cuda") -> None:
        self._device = device
        self._loaded = True
        self._whisper_model = None
        try:
            import whisper
            self._whisper_model = whisper.load_model("base", device=self._device)
        except ImportError:
            pass

    def add_voice_sample(
        self, name: str, audio: npt.NDArray[np.float32], sample_rate: int = 16000
    ) -> None:
        self._samples[name] = audio
        self._sample_rates[name] = sample_rate

    def remove_voice_sample(self, name: str) -> None:
        self._samples.pop(name, None)
        self._sample_rates.pop(name, None)

    def list_voices(self) -> list[str]:
        return list(self._samples.keys())

    def has_voice(self, name: str) -> bool:
        return name in self._samples

    def convert(
        self,
        audio: npt.NDArray[np.float32],
        sample_rate: int = 16000,
        target_voice: str | None = None,
        preserve_prosody: bool = True,
        pitch_shift: float = 0.0,
        formant_shift: float = 0.0,
    ) -> npt.NDArray[np.float32]:
        if not self._loaded or target_voice is None or target_voice not in self._samples:
            if pitch_shift != 0.0:
                return self._apply_pitch_shift(audio, sample_rate, pitch_shift)
            return audio

        try:
            return self._voice_convert_rvc(audio, sample_rate, target_voice, pitch_shift)
        except (ImportError, Exception):
            return self._voice_convert_stretch(audio, sample_rate, target_voice, pitch_shift)

    def _voice_convert_rvc(
        self,
        audio: npt.NDArray[np.float32],
        sample_rate: int,
        target_voice: str,
        pitch_shift: float,
    ) -> npt.NDArray[np.float32]:
        target_audio = self._samples[target_voice]
        target_rate = self._sample_rates[target_voice]

        try:
            import librosa

            target_feat = librosa.feature.mfcc(
                y=target_audio.astype(np.float32), sr=target_rate, n_mfcc=13
            )
            source_feat = librosa.feature.mfcc(
                y=audio.astype(np.float32), sr=sample_rate, n_mfcc=13
            )

            if target_feat.shape[1] > 0 and source_feat.shape[1] > 0:
                target_mean = np.mean(target_feat, axis=1)
                source_mean = np.mean(source_feat, axis=1)
                diff = target_mean - source_mean

                from scipy.interpolate import interp1d

                stretched = librosa.effects.time_stretch(audio, rate=1.0)

                result = self._apply_spectral_envelope(stretched, sample_rate, diff)

                if pitch_shift != 0.0:
                    result = self._apply_pitch_shift(result, sample_rate, pitch_shift)

                return result

            return self._apply_pitch_shift(audio, sample_rate, pitch_shift)
        except ImportError:
            return self._voice_convert_stretch(audio, sample_rate, target_voice, pitch_shift)

    def _apply_spectral_envelope(
        self,
        audio: npt.NDArray[np.float32],
        sample_rate: int,
        mfcc_diff: npt.NDArray[np.float32],
    ) -> npt.NDArray[np.float32]:
        spectrum = np.fft.rfft(audio)
        freqs = np.fft.rfftfreq(len(audio), 1.0 / sample_rate)
        n_mfcc = len(mfcc_diff)
        for i in range(min(n_mfcc, len(spectrum))):
            freq_bin = int(freqs[i] / (sample_rate / 2) * (len(spectrum) - 1))
            if freq_bin < len(spectrum):
                scale = 2.0 ** (mfcc_diff[i] / 10.0)
                spectrum[freq_bin] *= scale
        modified = np.fft.irfft(spectrum, n=len(audio))
        return modified.astype(np.float32)

    def _voice_convert_stretch(
        self,
        audio: npt.NDArray[np.float32],
        sample_rate: int,
        target_voice: str,
        pitch_shift: float,
    ) -> npt.NDArray[np.float32]:
        target_audio = self._samples[target_voice]
        target_rate = self._sample_rates[target_voice]

        try:
            import librosa

            target_mean_pitch = self._estimate_pitch(target_audio, target_rate)
            source_mean_pitch = self._estimate_pitch(audio, sample_rate)

            if target_mean_pitch > 0 and source_mean_pitch > 0:
                ratio = target_mean_pitch / source_mean_pitch
                semitones = 12 * np.log2(ratio)
                pitch_shift += semitones

            if abs(pitch_shift) > 0.5:
                return self._apply_pitch_shift(audio, sample_rate, pitch_shift)
            return audio
        except ImportError:
            if abs(pitch_shift) > 0.5:
                return self._apply_pitch_shift(audio, sample_rate, pitch_shift)
            return audio

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
                shifted = shifted[: len(audio)]
            elif len(shifted) < len(audio):
                shifted = np.pad(shifted, (0, len(audio) - len(shifted)))

            return shifted

    def transcribe(self, audio: npt.NDArray[np.float32], sample_rate: int = 16000) -> str:
        if self._whisper_model is None:
            return ""
        audio_float = audio.astype(np.float32)
        result = self._whisper_model.transcribe(audio_float, fp16=self._device == "cuda")
        return result["text"]

    def unload(self) -> None:
        self._samples.clear()
        self._sample_rates.clear()
        self._loaded = False
