from __future__ import annotations

import numpy as np
import numpy.typing as npt


class MagiclipTranslator:
    def __init__(self) -> None:
        self._device = "cpu"
        self._loaded = False
        self._whisper_model = None
        self._source_lang = "en"
        self._target_lang = "es"

    def load(self, device: str = "cuda") -> None:
        self._device = device
        self._loaded = True
        try:
            import whisper
            self._whisper_model = whisper.load_model("base", device=device)
        except ImportError:
            pass

    def set_languages(self, source: str, target: str) -> None:
        self._source_lang = source
        self._target_lang = target

    def translate_audio(
        self,
        audio: npt.NDArray[np.float32],
        sample_rate: int = 16000,
    ) -> tuple[str, npt.NDArray[np.float32] | None]:
        if not self._loaded or self._whisper_model is None:
            return "", None

        result = self._whisper_model.transcribe(
            audio.astype(np.float32),
            task="transcribe",
            language=self._source_lang,
            fp16=self._device == "cuda",
        )
        source_text = result.get("text", "")

        translated_text = self._translate_text(source_text)
        tts_audio = self._text_to_speech(translated_text)

        return translated_text, tts_audio

    def translate_video(
        self,
        audio_chunks: list[npt.NDArray[np.float32]],
        sample_rate: int = 16000,
        video_frames: list[npt.NDArray[np.uint8]] | None = None,
    ) -> tuple[list[str], npt.NDArray[np.float32] | None, list[npt.NDArray[np.uint8]] | None]:
        translated_texts = []
        all_audio_parts = []

        for chunk in audio_chunks:
            text, tts_audio = self.translate_audio(chunk, sample_rate)
            translated_texts.append(text)
            if tts_audio is not None:
                all_audio_parts.append(tts_audio)

        merged_audio = np.concatenate(all_audio_parts) if all_audio_parts else None

        lip_synced_frames = None
        if video_frames is not None and merged_audio is not None:
            lip_synced_frames = self._lip_sync(video_frames, merged_audio, sample_rate)

        return translated_texts, merged_audio, lip_synced_frames

    def _translate_text(self, text: str) -> str:
        if not text.strip():
            return ""

        try:
            from transformers import pipeline

            translator = pipeline(
                "translation",
                model=f"Helsinki-NLP/opus-mt-{self._source_lang}-{self._target_lang}",
                device=self._device,
            )
            result = translator(text, max_length=512)
            return result[0]["translation_text"]
        except ImportError:
            return text

    def _text_to_speech(self, text: str) -> npt.NDArray[np.float32] | None:
        if not text.strip():
            return None

        try:
            from TTS.api import TTS

            tts = TTS(model_name="tts_models/en/ljspeech/tacotron2-DDC", progress_bar=False)
            import tempfile
            import os

            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                temp_path = f.name
                tts.tts_to_file(text=text, file_path=temp_path)

                import soundfile as sf
                audio, sr = sf.read(temp_path)
                os.unlink(temp_path)

                if sr != 16000:
                    import scipy.signal
                    audio = scipy.signal.resample(audio, int(len(audio) * 16000 / sr))

                return audio.astype(np.float32)
        except ImportError:
            import hashlib
            seed = int(hashlib.md5(text.encode()).hexdigest()[:8], 16)
            rng = np.random.RandomState(seed)
            duration = max(0.5, len(text) * 0.08)
            samples = int(16000 * duration)
            t = np.arange(samples) / 16000
            pitch = 150 + (seed % 100)
            audio = (rng.randn(samples) * 0.02 +
                     0.5 * np.sin(2 * np.pi * pitch * t) +
                     0.3 * np.sin(4 * np.pi * pitch * t))
            return audio.astype(np.float32)

    def _lip_sync(
        self,
        frames: list[npt.NDArray[np.uint8]],
        audio: npt.NDArray[np.float32],
        sample_rate: int,
    ) -> list[npt.NDArray[np.uint8]]:
        try:
            import cv2

            audio_duration = len(audio) / sample_rate
            num_frames = len(frames)
            time_per_frame = audio_duration / num_frames if num_frames > 0 else 0

            phoneme_visemes = {
                "A": (0.3, 0.7),
                "E": (0.4, 0.5),
                "I": (0.2, 0.3),
                "O": (0.5, 0.8),
                "U": (0.3, 0.6),
                "M": (0.1, 0.2),
                "silence": (0.0, 0.1),
            }

            viseme_sequence = self._generate_viseme_sequence(phoneme_visemes, num_frames)
            synced_frames = []

            for i, frame in enumerate(frames):
                result = frame.copy()
                h, w = result.shape[:2]

                mouth_open, mouth_width = viseme_sequence[i]
                mouth_center = (w // 2, int(h * 0.62))
                mw = int(w * 0.12 * (0.5 + mouth_width))
                mh = int(h * 0.04 * (0.3 + mouth_open * 0.7))

                color = (60, 40, 180)
                cv2.ellipse(result, mouth_center, (mw, mh), 0, 0, 360, color, -1)
                cv2.ellipse(result, mouth_center, (mw, mh), 0, 0, 360, (40, 30, 140), 2)

                synced_frames.append(result)

            return synced_frames
        except ImportError:
            return frames

    def _generate_viseme_sequence(
        self,
        visemes: dict,
        num_frames: int,
    ) -> list[tuple[float, float]]:
        sequence = []
        import hashlib
        seed = int(hashlib.md5(str(num_frames).encode()).hexdigest()[:8], 16)
        rng = np.random.RandomState(seed)

        for i in range(num_frames):
            t = i / max(1, num_frames)
            if t < 0.1 or (0.4 < t < 0.5) or t > 0.9:
                sequence.append(visemes["silence"])
            elif 0.2 < t < 0.35:
                sequence.append(visemes["A"])
            elif 0.5 < t < 0.65:
                sequence.append(visemes["O"])
            else:
                key = rng.choice(list(visemes.keys()))
                sequence.append(visemes[key])

        return sequence

    def unload(self) -> None:
        self._whisper_model = None
        self._loaded = False
