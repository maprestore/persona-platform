from __future__ import annotations

import numpy as np
import numpy.typing as npt


class FaceSwapEngine:
    def __init__(self) -> None:
        self._detector = None
        self._swapper = None
        self._enhancer = None
        self._device = "cpu"

    def load(self, device: str = "cuda") -> None:
        self._device = device
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
    ) -> npt.NDArray[np.uint8]:
        if self._swapper is None:
            return target_img

        if source_faces is None:
            source_faces = self.detect(source_img)

        if not source_faces:
            return target_img

        target_faces = self.detect(target_img)
        result = target_img.copy()
        for tface in target_faces:
            result = self._swapper.get(
                result,
                tface["detector"],
                source_faces[0]["detector"],
                paste_back=True,
            )
        return result

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