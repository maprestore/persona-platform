from __future__ import annotations

import numpy as np
import numpy.typing as npt


class BackgroundRemover:
    def __init__(self) -> None:
        self._model = None
        self._device = "cpu"
        self._loaded = False

    def load(self, device: str = "cuda") -> None:
        self._device = device
        self._loaded = True

    def remove_background(
        self,
        image: npt.NDArray[np.uint8],
        method: str = "auto",
    ) -> tuple[npt.NDArray[np.uint8], npt.NDArray[np.uint8]]:
        if method == "rembg":
            return self._remove_rembg(image)
        elif method == "cv2":
            return self._remove_cv2(image)
        else:
            return self._remove_auto(image)

    def replace_background(
        self,
        image: npt.NDArray[np.uint8],
        background: npt.NDArray[np.uint8] | None = None,
        color: tuple[int, int, int] | None = None,
        method: str = "auto",
        blur_amount: int = 0,
    ) -> npt.NDArray[np.uint8]:
        fg_mask, fg = self.remove_background(image, method)

        if blur_amount > 0:
            try:
                import cv2
                fg_mask = cv2.GaussianBlur(fg_mask, (blur_amount * 2 + 1, blur_amount * 2 + 1), 0)
            except ImportError:
                pass

        mask_3ch = np.stack([fg_mask] * 3, axis=-1) / 255.0

        if background is not None:
            bg_resized = background
            if bg_resized.shape[:2] != image.shape[:2]:
                try:
                    import cv2
                    bg_resized = cv2.resize(bg_resized, (image.shape[1], image.shape[0]))
                except ImportError:
                    pass
            result = (fg * mask_3ch + bg_resized * (1 - mask_3ch)).astype(np.uint8)
        elif color is not None:
            solid = np.full_like(image, color, dtype=np.uint8)
            result = (fg * mask_3ch + solid * (1 - mask_3ch)).astype(np.uint8)
        else:
            result = fg

        return result

    def blur_background(
        self,
        image: npt.NDArray[np.uint8],
        kernel_size: int = 31,
        method: str = "auto",
    ) -> npt.NDArray[np.uint8]:
        try:
            import cv2
            fg_mask, _ = self.remove_background(image, method)
            mask_3ch = np.stack([fg_mask] * 3, axis=-1) / 255.0
            blurred = cv2.GaussianBlur(image, (kernel_size, kernel_size), 0)
            result = (image * mask_3ch + blurred * (1 - mask_3ch)).astype(np.uint8)
            return result
        except ImportError:
            return image

    def _remove_auto(
        self, image: npt.NDArray[np.uint8]
    ) -> tuple[npt.NDArray[np.uint8], npt.NDArray[np.uint8]]:
        try:
            return self._remove_rembg(image)
        except (ImportError, Exception):
            try:
                return self._remove_cv2(image)
            except (ImportError, Exception):
                h, w = image.shape[:2]
                mask = np.ones((h, w), dtype=np.uint8) * 255
                return mask, image

    def _remove_rembg(
        self, image: npt.NDArray[np.uint8]
    ) -> tuple[npt.NDArray[np.uint8], npt.NDArray[np.uint8]]:
        try:
            from rembg import remove as rembg_remove
            from PIL import Image

            pil_img = Image.fromarray(image)
            result = rembg_remove(pil_img)

            result_np = np.array(result)
            if result_np.shape[2] == 4:
                mask = result_np[:, :, 3]
                fg = result_np[:, :, :3]
            else:
                mask = np.ones(image.shape[:2], dtype=np.uint8) * 255
                fg = image

            return mask, fg
        except ImportError:
            return self._remove_cv2(image)

    def _remove_cv2(
        self, image: npt.NDArray[np.uint8]
    ) -> tuple[npt.NDArray[np.uint8], npt.NDArray[np.uint8]]:
        import cv2

        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
        else:
            gray = image

        edges = cv2.Canny(gray, 50, 150)
        kernel = np.ones((5, 5), np.uint8)
        closed = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)

        y_indices, x_indices = np.where(closed > 0)
        if len(y_indices) == 0:
            mask = np.ones(gray.shape, dtype=np.uint8) * 255
            return mask, image

        x_min, x_max = max(0, x_indices.min() - 10), min(gray.shape[1], x_indices.max() + 10)
        y_min, y_max = max(0, y_indices.min() - 10), min(gray.shape[0], y_indices.max() + 10)

        mask = np.zeros(gray.shape, dtype=np.uint8)
        mask[y_min:y_max, x_min:x_max] = 255

        mask = cv2.GaussianBlur(mask, (15, 15), 5)
        mask = (mask > 128).astype(np.uint8) * 255

        fg = cv2.bitwise_and(image, image, mask=mask)

        return mask, fg

    def unload(self) -> None:
        self._model = None
        self._loaded = False
