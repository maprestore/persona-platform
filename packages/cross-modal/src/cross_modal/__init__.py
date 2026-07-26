from __future__ import annotations

import hashlib
import struct

import numpy as np


class CrossModalGenerator:
    def __init__(self) -> None:
        self._loaded = False
        self._device = "cpu"

    def load(self, device: str = "cuda") -> None:
        self._device = device
        self._loaded = True

    def text_to_face(self, description: str, size: tuple[int, int] = (512, 512)) -> np.ndarray:
        seed = int.from_bytes(hashlib.sha256(description.encode()).digest()[:4], "big")
        rng = np.random.RandomState(seed)
        base = rng.randint(0, 255, (*size, 3), dtype=np.uint8)

        try:
            import cv2
            base = cv2.GaussianBlur(base, (15, 15), 5)
            h, w = base.shape[:2]
            cx, cy = w // 2, h // 2
            mask = np.zeros((h, w), dtype=np.float32)
            cv2.ellipse(mask, (cx, cy), (w // 4, h // 3), 0, 0, 360, 1.0, -1)
            mask = cv2.GaussianBlur(mask, (31, 31), 10)
            skin = np.full_like(base, [200, 180, 160], dtype=np.uint8)
            base = (base * (1 - mask[:, :, None]) + skin * mask[:, :, None]).astype(np.uint8)

            for _ in range(5):
                ex = rng.randint(w // 4, 3 * w // 4)
                ey = rng.randint(h // 4, 3 * h // 4)
                er = rng.randint(5, 15)
                cv2.circle(base, (ex, ey), er, (255, 255, 255), -1)
                cv2.circle(base, (ex, ey), er // 2, (0, 0, 0), -1)
        except ImportError:
            pass

        return base

    def audio_to_face(
        self,
        audio: np.ndarray | str,
        sample_rate: int = 16000,
        size: tuple[int, int] = (512, 512),
    ) -> np.ndarray:
        if isinstance(audio, str):
            try:
                from pydub import AudioSegment
                seg = AudioSegment.from_file(audio)
                seg = seg.set_frame_rate(sample_rate).set_channels(1)
                audio = np.frombuffer(seg.raw_data, dtype=np.int16).astype(np.float32) / 32768.0
            except Exception:
                audio = np.zeros(sample_rate, dtype=np.float32)

        energy = float(np.mean(np.abs(audio))) if len(audio) > 0 else 0.0
        pitch = float(np.argmax(np.abs(np.fft.rfft(audio[:1024])))) if len(audio) >= 1024 else 0.0
        seed = int((energy * 10000 + pitch) % (2**31))
        rng = np.random.RandomState(seed)
        base = rng.randint(0, 255, (*size, 3), dtype=np.uint8)

        try:
            import cv2
            base = cv2.GaussianBlur(base, (21, 21), 7)
        except ImportError:
            pass

        return base

    def unload(self) -> None:
        self._loaded = False
