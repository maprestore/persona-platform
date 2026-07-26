from __future__ import annotations

import numpy as np
import numpy.typing as npt
from shared.types import SwapEngine, VideoFrame, AudioFrame, TuningParams, WatermarkConfig
from .engines import FaceSwapEngine, VoiceConvertEngine, VoiceClonerEngine, LivePortraitEngine, BackgroundRemover, EffectsPipeline


class PersonaSwapCore(SwapEngine):
    def __init__(self) -> None:
        self._face = FaceSwapEngine()
        self._voice = VoiceConvertEngine()
        self._voice_cloner = VoiceClonerEngine()
        self._live_portrait = LivePortraitEngine()
        self._background = BackgroundRemover()
        self._effects = EffectsPipeline()
        self._loaded = False
        self._source_embedding: npt.NDArray | None = None
        self._tuning: TuningParams | None = None
        self._use_watermark: bool = True
        self._use_4k: bool = False

    def load(self, device: str = "cuda") -> None:
        self._face.load(device, use_4k=self._use_4k)
        self._voice.load(device)
        self._voice_cloner.load(device)
        self._live_portrait.load(device)
        self._background.load(device)
        self._loaded = True

    def set_source(self, image: npt.NDArray[np.uint8]) -> None:
        faces = self._face.detect(image)
        if faces:
            self._source_embedding = faces[0]["embedding"]

    def set_tuning(self, tuning: TuningParams) -> None:
        self._tuning = tuning

    def set_watermark(self, enabled: bool) -> None:
        self._use_watermark = enabled

    def set_4k_mode(self, enabled: bool) -> None:
        self._use_4k = enabled
        if self._loaded:
            self._face.load(self._face._device, use_4k=enabled)

    def swap(self, source: VideoFrame, target: VideoFrame) -> VideoFrame:
        if not self._loaded:
            return target
        swapped = self._face.swap(source.image, target.image, tuning=self._tuning)

        if self._use_watermark:
            from .watermark import add_watermark
            swapped = add_watermark(swapped)

        target.image = swapped
        return target

    def swap_batch(
        self,
        source: VideoFrame,
        targets: list[VideoFrame],
    ) -> list[VideoFrame]:
        if not self._loaded:
            return targets
        source_faces = self._face.detect(source.image)
        results = []
        for target in targets:
            swapped = self._face.swap(source.image, target.image, source_faces, tuning=self._tuning)
            if self._use_watermark:
                from .watermark import add_watermark
                swapped = add_watermark(swapped)
            target.image = swapped
            results.append(target)
        return results

    def swap_with_background(
        self,
        source: VideoFrame,
        target: VideoFrame,
        background: npt.NDArray[np.uint8] | None = None,
        bg_color: tuple[int, int, int] | None = None,
    ) -> VideoFrame:
        swapped = self.swap(source, target)
        swapped.image = self._background.replace_background(
            swapped.image, background=background, color=bg_color
        )
        return swapped

    def apply_filter(self, frame: VideoFrame, filter_name: str, intensity: float = 1.0) -> VideoFrame:
        frame.image = self._effects.apply_filter(frame.image, filter_name, intensity)
        return frame

    def animate_portrait(
        self,
        source_image: npt.NDArray[np.uint8],
        expression: str = "smile",
        intensity: float = 1.0,
        driving_video: list[npt.NDArray[np.uint8]] | None = None,
    ) -> list[npt.NDArray[np.uint8]]:
        return self._live_portrait.animate(source_image, driving_video, expression, intensity)

    def remove_background(
        self,
        image: npt.NDArray[np.uint8],
        method: str = "auto",
    ) -> tuple[npt.NDArray[np.uint8], npt.NDArray[np.uint8]]:
        return self._background.remove_background(image, method)

    def replace_background(
        self,
        image: npt.NDArray[np.uint8],
        background: npt.NDArray[np.uint8] | None = None,
        color: tuple[int, int, int] | None = None,
        method: str = "auto",
        blur_amount: int = 0,
    ) -> npt.NDArray[np.uint8]:
        return self._background.replace_background(image, background, color, method, blur_amount)

    def blur_background(
        self,
        image: npt.NDArray[np.uint8],
        kernel_size: int = 31,
        method: str = "auto",
    ) -> npt.NDArray[np.uint8]:
        return self._background.blur_background(image, kernel_size, method)

    def convert_voice(self, audio: AudioFrame, target_voice: str | None = None) -> AudioFrame:
        converted = self._voice.convert(audio.samples, audio.sample_rate, target_voice)
        audio.samples = converted
        return audio

    def clone_voice(
        self,
        audio: AudioFrame,
        target_voice: str,
        pitch_shift: float = 0.0,
        formant_shift: float = 0.0,
    ) -> AudioFrame:
        converted = self._voice_cloner.convert(
            audio.samples, audio.sample_rate, target_voice,
            pitch_shift=pitch_shift, formant_shift=formant_shift,
        )
        audio.samples = converted
        return audio

    def add_voice_sample(
        self, name: str, audio: npt.NDArray[np.float32], sample_rate: int = 16000
    ) -> None:
        self._voice_cloner.add_voice_sample(name, audio, sample_rate)

    def list_voices(self) -> list[str]:
        return self._voice_cloner.list_voices()

    def transcribe(self, audio: AudioFrame) -> str:
        return self._voice.transcribe(audio.samples, audio.sample_rate)

    def list_filters(self) -> list[str]:
        return self._effects.list_filters()

    def unload(self) -> None:
        self._face.unload()
        self._voice.unload()
        self._voice_cloner.unload()
        self._live_portrait.unload()
        self._background.unload()
        self._effects.unload()
        self._loaded = False
