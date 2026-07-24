from __future__ import annotations

import cv2
import numpy as np
import numpy.typing as npt
from shared.types import SwapEngine, VideoFrame, AudioFrame
from .engines import FaceSwapEngine, VoiceConvertEngine


class PersonaSwapCore(SwapEngine):
    def __init__(self) -> None:
        self._face = FaceSwapEngine()
        self._voice = VoiceConvertEngine()
        self._loaded = False
        self._source_embedding: npt.NDArray | None = None

    def load(self, device: str = "cuda") -> None:
        self._face.load(device)
        self._voice.load(device)
        self._loaded = True

    def set_source(self, image: npt.NDArray[np.uint8]) -> None:
        faces = self._face.detect(image)
        if faces:
            self._source_embedding = faces[0]["embedding"]

    def swap(self, source: VideoFrame, target: VideoFrame) -> VideoFrame:
        if not self._loaded:
            return target
        swapped = self._face.swap(source.image, target.image)
        target.image = swapped
        return target

    def convert_voice(self, audio: AudioFrame, target_voice: str | None = None) -> AudioFrame:
        converted = self._voice.convert(audio.samples, audio.sample_rate, target_voice)
        audio.samples = converted
        return audio

    def transcribe(self, audio: AudioFrame) -> str:
        return self._voice.transcribe(audio.samples, audio.sample_rate)

    def unload(self) -> None:
        self._face.unload()
        self._voice.unload()
        self._loaded = False