from __future__ import annotations

import numpy as np
import numpy.typing as npt
from shared.types import TuningParams


class FaceSwapEngine:
    def __init__(self) -> None:
        self._detector = None
        self._swapper = None
        self._enhancer = None
        self._device = "cpu"
        self._use_4k = False

    @property
    def device(self) -> str:
        return self._device

    def load(self, device: str = "cuda", use_4k: bool = False) -> None:
        self._device = device
        self._use_4k = use_4k
        try:
            import insightface
            from insightface.app import FaceAnalysis
            self._detector = FaceAnalysis(
                name="buffalo_l",
                providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
            )
            self._detector.prepare(ctx_id=0 if device == "cuda" else -1)

            model_path = insightface.model_zoo.get_model(
                "inswapper_128.onnx",
                download=True,
                providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
            )
            self._swapper = model_path
        except ImportError:
            pass

    def detect(
        self, image: npt.NDArray[np.uint8]
    ) -> list[dict]:
        if self._detector is None:
            return []
        faces = self._detector.get(image)
        results = []
        for face in faces:
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
            return target_img

        if source_faces is None:
            source_faces = self.detect(source_img)

        if not source_faces:
            return target_img

        if self._use_4k:
            target_img = self._upscale_image(target_img)

        target_faces = self.detect(target_img)
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
    ) -> list[npt.NDArray[np.uint8]]:
        source_faces = self.detect(source_img)
        if not source_faces:
            return target_frames

        results = []
        for frame in target_frames:
            result = self.swap(source_img, frame, source_faces, tuning)
            if use_watermark:
                from ..watermark import add_watermark
                result = add_watermark(result)
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

            kernel_size = max(3, int(smoothness * 20))
            if kernel_size % 2 == 0:
                kernel_size += 1

            face_region = image[y1:y2, x1:x2]
            blurred = cv2.GaussianBlur(face_region, (kernel_size, kernel_size), 0)
            image[y1:y2, x1:x2] = blurred
            return image
        except (ImportError, Exception):
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

            mask = np.zeros((h, w), dtype=np.float32)
            cv2.rectangle(mask, (x1, y1), (x2, y2), 1.0, -1)

            kernel_size = max(3, int(feather * 50))
            if kernel_size % 2 == 0:
                kernel_size += 1
            mask = cv2.GaussianBlur(mask, (kernel_size, kernel_size), 0)

            mask_3ch = np.stack([mask] * 3, axis=-1)
            result = (image * mask_3ch + original * (1 - mask_3ch)).astype(np.uint8)
            return result
        except (ImportError, Exception):
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
                self._enhancer = GFPGANer(
                    model_path="experiments/pretrained_models/GFPGANv1.4.pth",
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


def cv2_add_weighted(
    img1: npt.NDArray[np.uint8],
    img2: npt.NDArray[np.uint8],
    alpha: float,
) -> npt.NDArray[np.uint8]:
    try:
        import cv2
        return cv2.addWeighted(img1, 1 - alpha, img2, alpha, 0)
    except ImportError:
        return (img1.astype(np.float32) * (1 - alpha) + img2.astype(np.float32) * alpha).astype(np.uint8)
