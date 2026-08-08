
from __future__ import annotations

import logging
import os
from pathlib import Path
import numpy as np
import numpy.typing as npt
from shared.types import TuningParams
from shared.utils import cv2_add_weighted

logger = logging.getLogger(__name__)


class FaceSwapEngine:
    def __init__(self) -> None:
        self._detector = None
        self._swapper = None
        self._enhancer = None
        self._device = "cpu"
        self._use_4k = False
        self._load_error: str | None = None

    @property
    def device(self) -> str:
        return self._device

    def load(self, device: str = "cuda", use_4k: bool = False) -> None:
        self._device = device
        self._use_4k = use_4k
        self._load_error = None
        self._detector = None
        self._swapper = None
        try:
            import insightface
            import os
            from insightface.app import FaceAnalysis
            providers = (
                ["CUDAExecutionProvider", "CPUExecutionProvider"]
                if device == "cuda"
                else ["CPUExecutionProvider"]
            )
            root = os.path.join(os.path.expanduser("~"), ".insightface", "models")
            # Try buffalo_l (current name on GitHub); fall back to buffalo_1 for older images
            model_name = "buffalo_l"
            try:
                self._detector = FaceAnalysis(name=model_name, root=root, download=True, providers=providers)
            except Exception:
                model_name = "buffalo_1"
                self._detector = FaceAnalysis(name=model_name, root=root, download=True, providers=providers)
            self._detector.prepare(ctx_id=0 if device == "cuda" else -1)

            swapper_path = os.path.join(root, "inswapper_128.onnx")
            if os.path.isfile(swapper_path):
                self._swapper = insightface.model_zoo.get_model(
                    swapper_path, download=False, providers=providers
                )
            else:
                self._swapper = insightface.model_zoo.get_model(
                    "inswapper_128.onnx", download=True, providers=providers
                )
        except (ImportError, RuntimeError, OSError) as exc:
            self._detector = None
            self._swapper = None
            self._load_error = str(exc) or exc.__class__.__name__

    @property
    def available(self) -> bool:
        return self._detector is not None and self._swapper is not None

    @property
    def load_error(self) -> str | None:
        return self._load_error

    def detect(
        self, image: npt.NDArray[np.uint8]
    ) -> list[dict]:
        if self._detector is None:
            return []
        faces = self._detector.get(image)
        results = []
        for face in faces:
            if face.landmark is None or face.bbox is None or face.embedding is None:
                continue
            results.append({
                "bbox": face.bbox.tolist(),
                "landmarks": face.landmark.tolist(),
                "embedding": face.embedding,
                "detector": face,
            })
        return results

    def swap(
        self,
        source_img: npt.NDArray[np.uint8],
        target_img: npt.NDArray[np.uint8],
        source_faces: list[dict] | None = None,
        tuning: TuningParams | None = None,
    ) -> npt.NDArray[np.uint8]:
        if self._swapper is None:
            logger.debug("swapper is None, returning target")
            return target_img

        if source_faces is None:
            source_faces = self.detect(source_img)

        if not source_faces:
            logger.debug("no source faces, returning target")
            return target_img

        if self._use_4k:
            target_img = self._upscale_image(target_img)

        target_faces = self.detect(target_img)
        logger.debug("source_faces=%d, target_faces=%d", len(source_faces), len(target_faces))
        result = target_img.copy()

        if tuning is None:
            tuning = TuningParams()

        for tface in target_faces:
            swapped = self._swapper.get(
                result,
                tface["detector"],
                source_faces[0]["detector"],
                paste_back=True,
            )

            if tuning.face_align_strength != 1.0:
                swapped = self._adjust_alignment(result, swapped, tuning.face_align_strength)

            if tuning.color_correction:
                swapped = self._color_correct(swapped, source_img, tuning.blend_ratio)

            if tuning.smoothness > 0:
                swapped = self._smooth_edges(swapped, tface, tuning.smoothness)

            if tuning.edge_feathering > 0:
                swapped = self._feather_edges(swapped, tface, target_img, tuning.edge_feathering)

            result = swapped

        if self._use_4k:
            result = self._enhance_detail(result)

        return result

    def swap_face_video(
        self,
        source_img: npt.NDArray[np.uint8],
        target_frames: list[npt.NDArray[np.uint8]],
        tuning: TuningParams | None = None,
        use_watermark: bool = False,
        temporal_blend: float = 0.15,
    ) -> list[npt.NDArray[np.uint8]]:
        """
        Swap faces in video frames with temporal consistency.
        
        Args:
            source_img: Source face image
            target_frames: List of target video frames
            tuning: Tuning parameters
            use_watermark: Whether to add watermark
            temporal_blend: Blending factor with previous frame (0=off, 0.3=max)
        """
        source_faces = self.detect(source_img)
        if not source_faces:
            return target_frames

        results = []
        prev_result = None
        for frame in target_frames:
            result = self.swap(source_img, frame, source_faces, tuning)
            if use_watermark:
                from ..watermark import add_watermark
                result = add_watermark(result)

            # Temporal consistency: blend with previous frame
            if prev_result is not None and temporal_blend > 0:
                try:
                    import cv2
                    # Create face mask from current detection
                    target_faces = self.detect(frame)
                    if target_faces:
                        bbox = target_faces[0]["bbox"]
                        x1, y1, x2, y2 = [int(v) for v in bbox]
                        h, w = frame.shape[:2]
                        x1, y1 = max(0, x1), max(0, y1)
                        x2, y2 = min(w, x2), min(h, y2)
                        
                        if x2 > x1 and y2 > y1:
                            # Create soft mask for face region
                            mask = np.zeros((h, w), dtype=np.float32)
                            cv2.rectangle(mask, (x1, y1), (x2, y2), 1.0, -1)
                            kernel_size = max(3, int((x2 - x1) * 0.3))
                            if kernel_size % 2 == 0:
                                kernel_size += 1
                            mask = cv2.GaussianBlur(mask, (kernel_size, kernel_size), 0)
                            mask_3ch = np.stack([mask] * 3, axis=-1)
                            
                            # Blend only the face region with previous result
                            result = (result * mask_3ch + prev_result * (1 - mask_3ch)).astype(np.uint8)
                except Exception:
                    pass  # Skip blending on error

            prev_result = result.copy()
            results.append(result)

        return results

    def _adjust_alignment(
        self,
        original: npt.NDArray[np.uint8],
        swapped: npt.NDArray[np.uint8],
        strength: float,
    ) -> npt.NDArray[np.uint8]:
        return cv2_add_weighted(original, swapped, strength)

    def _color_correct(
        self,
        swapped: npt.NDArray[np.uint8],
        source: npt.NDArray[np.uint8],
        blend_ratio: float,
    ) -> npt.NDArray[np.uint8]:
        try:
            import cv2

            src_lab = cv2.cvtColor(source, cv2.COLOR_RGB2LAB)
            dst_lab = cv2.cvtColor(swapped, cv2.COLOR_RGB2LAB)

            for i in range(3):
                src_mean = np.mean(src_lab[:, :, i])
                src_std = np.std(src_lab[:, :, i])
                dst_mean = np.mean(dst_lab[:, :, i])
                dst_std = np.std(dst_lab[:, :, i])

                if dst_std > 0:
                    corrected = (dst_lab[:, :, i].astype(np.float32) - dst_mean) * (src_std / dst_std) + src_mean
                    dst_lab[:, :, i] = np.clip(corrected, 0, 255).astype(np.uint8)

            corrected = cv2.cvtColor(dst_lab, cv2.COLOR_LAB2RGB)

            if blend_ratio < 1.0:
                corrected = cv2_add_weighted(swapped, corrected, blend_ratio)

            return corrected
        except ImportError:
            return swapped

    def _smooth_edges(
        self,
        image: npt.NDArray[np.uint8],
        face: dict,
        smoothness: float,
    ) -> npt.NDArray[np.uint8]:
        try:
            import cv2
            bbox = face["bbox"]
            x1, y1, x2, y2 = [int(v) for v in bbox]
            h, w = image.shape[:2]
            x1 = max(0, x1)
            y1 = max(0, y1)
            x2 = min(w, x2)
            y2 = min(h, y2)
            if x2 <= x1 or y2 <= y1:
                return image

            kernel_size = max(3, int(smoothness * 20))
            if kernel_size % 2 == 0:
                kernel_size += 1

            face_region = image[y1:y2, x1:x2]
            blurred = cv2.GaussianBlur(face_region, (kernel_size, kernel_size), 0)
            image[y1:y2, x1:x2] = blurred
            return image
        except (ImportError, ValueError, KeyError):
            return image

    def _feather_edges(
        self,
        image: npt.NDArray[np.uint8],
        face: dict,
        original: npt.NDArray[np.uint8],
        feather: float,
    ) -> npt.NDArray[np.uint8]:
        try:
            import cv2
            bbox = face["bbox"]
            x1, y1, x2, y2 = [int(v) for v in bbox]
            h, w = image.shape[:2]
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w - 1, x2), min(h - 1, y2)
            if x2 <= x1 or y2 <= y1 or original.shape != image.shape:
                return image

            mask = np.zeros((h, w), dtype=np.float32)
            cv2.rectangle(mask, (x1, y1), (x2, y2), 1.0, -1)

            kernel_size = max(3, int(feather * 50))
            if kernel_size % 2 == 0:
                kernel_size += 1
            mask = cv2.GaussianBlur(mask, (kernel_size, kernel_size), 0)

            mask_3ch = np.stack([mask] * 3, axis=-1)
            result = (image * mask_3ch + original * (1 - mask_3ch)).astype(np.uint8)
            return result
        except (ImportError, ValueError, KeyError):
            return image

    def _upscale_image(self, image: npt.NDArray[np.uint8]) -> npt.NDArray[np.uint8]:
        try:
            import cv2
            h, w = image.shape[:2]
            if h < 2160 and w < 3840:
                scale = min(3840 / w, 2160 / h, 2.0)
                new_w = int(w * scale)
                new_h = int(h * scale)
                return cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_CUBIC)
            return image
        except ImportError:
            return image

    def _enhance_detail(self, image: npt.NDArray[np.uint8]) -> npt.NDArray[np.uint8]:
        try:
            import cv2
            sharpen = np.array([[-1, -1, -1],
                                 [-1, 9, -1],
                                 [-1, -1, -1]])
            return cv2.filter2D(image, -1, sharpen)
        except ImportError:
            return image

    def enhance(self, image: npt.NDArray[np.uint8]) -> npt.NDArray[np.uint8]:
        try:
            from gfpgan import GFPGANer
            if self._enhancer is None:
                model_path = os.environ.get(
                    "GFPGAN_MODEL_PATH",
                    str(Path(__file__).resolve().parent.parent.parent.parent / "experiments" / "pretrained_models" / "GFPGANv1.4.pth"),
                )
                self._enhancer = GFPGANer(
                    model_path=model_path,
                    upscale=1,
                    arch="clean",
                    channel_multiplier=2,
                )
            _, _, result = self._enhancer.enhance(image)
            return result
        except ImportError:
            return image

    def unload(self) -> None:
        self._detector = None
        self._swapper = None
        self._enhancer = None
        self._load_error = None
