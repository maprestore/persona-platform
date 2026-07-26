from __future__ import annotations

import numpy as np
import numpy.typing as npt


class EffectsPipeline:
    def __init__(self) -> None:
        self._loaded = True

    def apply_filter(
        self,
        image: npt.NDArray[np.uint8],
        filter_name: str = "none",
        intensity: float = 1.0,
    ) -> npt.NDArray[np.uint8]:
        if filter_name == "none":
            return image

        filters = {
            "grayscale": self._grayscale,
            "sepia": self._sepia,
            "vintage": self._vintage,
            "vibrant": self._vibrant,
            "cool": self._cool,
            "warm": self._warm,
            "dramatic": self._dramatic,
            "invert": self._invert,
            "cartoon": self._cartoon,
            "oil_paint": self._oil_paint,
            "sketch": self._sketch,
            "neon": self._neon,
            "blur": self._blur,
            "sharpen": self._sharpen,
            "edge_detect": self._edge_detect,
            "emboss": self._emboss,
            "pixelate": self._pixelate,
            "glitch": self._glitch,
        }

        if filter_name in filters:
            result = filters[filter_name](image)
            if intensity != 1.0:
                result = cv2_add_weighted(image, result, intensity)
            return result
        return image

    def list_filters(self) -> list[str]:
        return [
            "none", "grayscale", "sepia", "vintage", "vibrant",
            "cool", "warm", "dramatic", "invert", "cartoon",
            "oil_paint", "sketch", "neon", "blur", "sharpen",
            "edge_detect", "emboss", "pixelate", "glitch",
        ]

    def _grayscale(self, img: npt.NDArray[np.uint8]) -> npt.NDArray[np.uint8]:
        try:
            import cv2
            gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
            return cv2.cvtColor(gray, cv2.COLOR_GRAY2RGB)
        except ImportError:
            return np.dot(img[..., :3], [0.299, 0.587, 0.114]).astype(np.uint8)

    def _sepia(self, img: npt.NDArray[np.uint8]) -> npt.NDArray[np.uint8]:
        result = img.astype(np.float32)
        sepia_filter = np.array([[0.393, 0.769, 0.189],
                                  [0.349, 0.686, 0.168],
                                  [0.272, 0.534, 0.131]])
        result = result @ sepia_filter.T
        return np.clip(result, 0, 255).astype(np.uint8)

    def _vintage(self, img: npt.NDArray[np.uint8]) -> npt.NDArray[np.uint8]:
        result = self._sepia(img)
        result = (result * 0.85).astype(np.uint8)
        noise = np.random.randint(0, 20, result.shape, dtype=np.uint8)
        result = np.clip(result.astype(np.int16) + noise, 0, 255).astype(np.uint8)
        return result

    def _vibrant(self, img: npt.NDArray[np.uint8]) -> npt.NDArray[np.uint8]:
        try:
            import cv2
            hsv = cv2.cvtColor(img, cv2.COLOR_RGB2HSV)
            hsv[:, :, 1] = np.clip(hsv[:, :, 1] * 1.5, 0, 255).astype(np.uint8)
            return cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB)
        except ImportError:
            return img

    def _cool(self, img: npt.NDArray[np.uint8]) -> npt.NDArray[np.uint8]:
        result = img.astype(np.float32)
        result[:, :, 0] *= 0.9
        result[:, :, 2] *= 1.3
        return np.clip(result, 0, 255).astype(np.uint8)

    def _warm(self, img: npt.NDArray[np.uint8]) -> npt.NDArray[np.uint8]:
        result = img.astype(np.float32)
        result[:, :, 0] *= 1.2
        result[:, :, 2] *= 0.8
        return np.clip(result, 0, 255).astype(np.uint8)

    def _dramatic(self, img: npt.NDArray[np.uint8]) -> npt.NDArray[np.uint8]:
        try:
            import cv2
            lab = cv2.cvtColor(img, cv2.COLOR_RGB2LAB)
            l, a, b = cv2.split(lab)
            clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
            l = clahe.apply(l)
            merged = cv2.merge([l, a, b])
            return cv2.cvtColor(merged, cv2.COLOR_LAB2RGB)
        except ImportError:
            return img

    def _invert(self, img: npt.NDArray[np.uint8]) -> npt.NDArray[np.uint8]:
        return 255 - img

    def _cartoon(self, img: npt.NDArray[np.uint8]) -> npt.NDArray[np.uint8]:
        try:
            import cv2
            gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
            gray = cv2.medianBlur(gray, 5)
            edges = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C,
                                          cv2.THRESH_BINARY, 9, 9)
            color = cv2.bilateralFilter(img, 9, 300, 300)
            return cv2.bitwise_and(color, color, mask=edges)
        except ImportError:
            return img

    def _oil_paint(self, img: npt.NDArray[np.uint8]) -> npt.NDArray[np.uint8]:
        try:
            import cv2
            return cv2.xphoto.oilPainting(img, 7, 1)
        except (ImportError, AttributeError):
            try:
                import cv2
                return cv2.bilateralFilter(img, 9, 75, 75)
            except ImportError:
                return img

    def _sketch(self, img: npt.NDArray[np.uint8]) -> npt.NDArray[np.uint8]:
        try:
            import cv2
            gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
            inv = 255 - gray
            blur = cv2.GaussianBlur(inv, (21, 21), 0)
            sketch = cv2.divide(gray, 255 - blur, scale=256)
            return cv2.cvtColor(sketch, cv2.COLOR_GRAY2RGB)
        except ImportError:
            return img

    def _neon(self, img: npt.NDArray[np.uint8]) -> npt.NDArray[np.uint8]:
        try:
            import cv2
            gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
            edges = cv2.Canny(gray, 50, 150)
            colored_edges = np.zeros_like(img)
            colored_edges[edges > 0] = [0, 255, 255]
            return colored_edges
        except ImportError:
            return img

    def _blur(self, img: npt.NDArray[np.uint8]) -> npt.NDArray[np.uint8]:
        try:
            import cv2
            return cv2.GaussianBlur(img, (15, 15), 0)
        except ImportError:
            kernel = np.ones((5, 5), dtype=np.float32) / 25
            return convolve2d(img, kernel)

    def _sharpen(self, img: npt.NDArray[np.uint8]) -> npt.NDArray[np.uint8]:
        try:
            import cv2
            kernel = np.array([[-1, -1, -1],
                               [-1, 9, -1],
                               [-1, -1, -1]])
            return cv2.filter2D(img, -1, kernel)
        except ImportError:
            return img

    def _edge_detect(self, img: npt.NDArray[np.uint8]) -> npt.NDArray[np.uint8]:
        try:
            import cv2
            gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
            edges = cv2.Canny(gray, 50, 150)
            return cv2.cvtColor(edges, cv2.COLOR_GRAY2RGB)
        except ImportError:
            return img

    def _emboss(self, img: npt.NDArray[np.uint8]) -> npt.NDArray[np.uint8]:
        try:
            import cv2
            kernel = np.array([[-2, -1, 0],
                               [-1, 1, 1],
                               [0, 1, 2]])
            gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
            embossed = cv2.filter2D(gray, -1, kernel)
            return cv2.cvtColor(embossed + 128, cv2.COLOR_GRAY2RGB)
        except ImportError:
            return img

    def _pixelate(self, img: npt.NDArray[np.uint8]) -> npt.NDArray[np.uint8]:
        try:
            import cv2
            h, w = img.shape[:2]
            pixel_size = 10
            temp = cv2.resize(img, (w // pixel_size, h // pixel_size), interpolation=cv2.INTER_LINEAR)
            return cv2.resize(temp, (w, h), interpolation=cv2.INTER_NEAREST)
        except ImportError:
            return img

    def _glitch(self, img: npt.NDArray[np.uint8]) -> npt.NDArray[np.uint8]:
        result = img.copy()
        h, w = result.shape[:2]
        try:
            for channel in range(3):
                offset = np.random.randint(-10, 10)
                shift = np.random.randint(0, h // 4)
                if offset != 0:
                    result[shift:shift + h // 8, :, channel] = np.roll(
                        result[shift:shift + h // 8, :, channel], offset, axis=1
                    )
        except Exception:
            pass
        return result

    def unload(self) -> None:
        self._loaded = False


def cv2_add_weighted(
    img1: npt.NDArray[np.uint8],
    img2: npt.NDArray[np.uint8],
    alpha: float,
) -> npt.NDArray[np.uint8]:
    try:
        import cv2
        return cv2.addWeighted(img1, 1 - alpha, img2, alpha, 0)
    except ImportError:
        return (img1 * (1 - alpha) + img2 * alpha).astype(np.uint8)


def convolve2d(img: npt.NDArray[np.uint8], kernel: npt.NDArray[np.float32]) -> npt.NDArray[np.uint8]:
    try:
        from scipy.ndimage import convolve
    except ImportError:
        return img
    if len(img.shape) == 3:
        result = np.zeros_like(img)
        for c in range(img.shape[2]):
            result[:, :, c] = convolve(img[:, :, c], kernel)
        return result
    return convolve(img, kernel).astype(np.uint8)
