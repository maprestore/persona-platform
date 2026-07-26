from __future__ import annotations

import numpy as np
from shared.types import VideoFrame


class SemanticSceneEngine:
    def __init__(self) -> None:
        self._loaded = True
        self._scene_classifier = None

    def analyze(self, frame: VideoFrame) -> dict:
        img = frame.image.astype(np.float32)
        h, w = img.shape[:2]

        brightness = float(np.mean(img))
        contrast = float(np.std(img))

        lower = img[h // 2 :, :, :]
        upper = img[: h // 2, :, :]
        lower_brightness = float(np.mean(lower))
        upper_brightness = float(np.mean(upper))
        is_outdoor = lower_brightness > upper_brightness

        edges = 0
        try:
            import cv2
            gray = cv2.cvtColor(img.astype(np.uint8), cv2.COLOR_RGB2GRAY) if len(img.shape) == 3 else img.astype(np.uint8)
            edges = int(np.sum(cv2.Canny(gray, 50, 150) > 0))
        except ImportError:
            edges = int(np.sum(np.abs(np.diff(img.mean(axis=2), axis=0)) > 20))

        edge_density = edges / (h * w)

        if brightness > 150:
            scene_type = "bright_indoor"
        elif brightness < 60:
            scene_type = "dark_night"
        elif is_outdoor and edge_density > 0.05:
            scene_type = "urban_outdoor"
        elif is_outdoor:
            scene_type = "natural_outdoor"
        else:
            scene_type = "indoor"

        depth_map = self._estimate_depth(img)

        return {
            "scene_type": scene_type,
            "brightness": brightness,
            "contrast": contrast,
            "edge_density": edge_density,
            "is_outdoor": is_outdoor,
            "depth_map": depth_map,
            "width": w,
            "height": h,
        }

    def _estimate_depth(self, img: np.ndarray) -> np.ndarray | None:
        try:
            import cv2
            gray = cv2.cvtColor(img.astype(np.uint8), cv2.COLOR_RGB2GRAY)
            depth = cv2.distanceTransform(
                cv2.Canny(gray, 50, 150),
                cv2.DIST_L2,
                5,
            )
            depth = (depth / (depth.max() + 1e-6) * 255).astype(np.uint8) if depth.max() > 0 else depth.astype(np.uint8)
            return depth
        except ImportError:
            return None

    def relight(self, frame: VideoFrame, scene_params: dict | None = None) -> VideoFrame:
        if scene_params is None:
            scene_params = self.analyze(frame)

        img = frame.image.astype(np.float32)
        brightness = scene_params.get("brightness", 128.0)
        target_brightness = 128.0
        scale = target_brightness / (brightness + 1e-6)
        scale = np.clip(scale, 0.5, 2.0)

        relit = np.clip(img * scale, 0, 255).astype(np.uint8)

        if scene_params.get("scene_type", "").startswith("dark"):
            relit = np.clip(relit * 1.3, 0, 255).astype(np.uint8)

        return VideoFrame(image=relit)

    def unload(self) -> None:
        self._loaded = False
