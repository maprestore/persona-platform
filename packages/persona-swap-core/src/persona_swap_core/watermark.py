from __future__ import annotations

import numpy as np
import numpy.typing as npt
from shared.types import VideoFrame, WatermarkConfig


WATERMARK_TEXT = "Persona Studio Free"
WATERMARK_OPACITY = 0.6
WATERMARK_FONT_SIZE = 28


def add_watermark(
    image: npt.NDArray[np.uint8],
    text: str = WATERMARK_TEXT,
    opacity: float = WATERMARK_OPACITY,
    position: str = "bottom_right",
    font_size: int = WATERMARK_FONT_SIZE,
) -> npt.NDArray[np.uint8]:
    try:
        import cv2

        result = image.copy()
        h, w = result.shape[:2]

        font = cv2.FONT_HERSHEY_SIMPLEX
        thickness = 2

        (text_w, text_h), baseline = cv2.getTextSize(text, font, font_size / 20, thickness)

        padding = 20
        if position == "bottom_right":
            x = w - text_w - padding
            y = h - padding
        elif position == "bottom_left":
            x = padding
            y = h - padding
        elif position == "top_right":
            x = w - text_w - padding
            y = text_h + padding
        elif position == "top_left":
            x = padding
            y = text_h + padding
        elif position == "center":
            x = (w - text_w) // 2
            y = (h + text_h) // 2
        else:
            x = w - text_w - padding
            y = h - padding

        overlay = result.copy()
        cv2.putText(overlay, text, (x, y), font, font_size / 20, (255, 255, 255), thickness, cv2.LINE_AA)

        result = cv2.addWeighted(overlay, opacity, result, 1 - opacity, 0)

        return result
    except ImportError:
        return image


def add_watermark_frame(
    frame: VideoFrame,
    config: WatermarkConfig | None = None,
) -> VideoFrame:
    if config is None:
        frame.image = add_watermark(frame.image)
    else:
        frame.image = add_watermark(
            frame.image,
            text=config.text if config.text else WATERMARK_TEXT,
            opacity=config.opacity,
            position=config.position,
            font_size=config.font_size,
        )
    return frame
