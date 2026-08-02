from __future__ import annotations

import os
import sys
import struct
import logging
from pathlib import Path

if sys.platform == "linux":
    import fcntl
else:
    fcntl = None  # type: ignore[assignment]

import numpy as np
import numpy.typing as npt

logger = logging.getLogger(__name__)

V4L2_CAP_VIDEO_OUTPUT = 0x00000001
VIDIOC_QUERYCAP = 0x80685600
CAMERA_DEVICES = [f"/dev/video{i}" for i in range(16)]


def cv2_add_weighted(
    img1: npt.NDArray[np.uint8],
    img2: npt.NDArray[np.uint8],
    alpha: float,
) -> npt.NDArray[np.uint8]:
    try:
        import cv2
        return cv2.addWeighted(img1, 1 - alpha, img2, alpha, 0)
    except ImportError:
        return (img1.astype(np.float32) * (1 - alpha) + img2.astype(np.float32) * alpha).astype(
            np.uint8
        )


def detect_cameras() -> list[dict]:
    cameras = []
    for dev in CAMERA_DEVICES:
        if not os.path.exists(dev):
            continue
        info: dict = {"device": dev, "name": f"Camera {dev}", "type": "unknown", "driver": ""}
        if sys.platform != "linux":
            info["type"] = "inaccessible"
            cameras.append(info)
            continue
        fd = -1
        try:
            fd = os.open(dev, os.O_RDWR | os.O_NONBLOCK)
            cap = struct.pack("I32s32s32s2I", 0, b"", b"", b"", 0, 0)
            result = fcntl.ioctl(fd, VIDIOC_QUERYCAP, cap)
            caps = struct.unpack("I32s32s32s2I", result)
            driver = caps[1].rstrip(b"\x00").decode("utf-8", errors="replace")
            name = caps[2].rstrip(b"\x00").decode("utf-8", errors="replace")
            info["driver"] = driver
            info["name"] = name or f"Device {dev}"

            if "v4l2loopback" in driver.lower() or "loopback" in driver.lower():
                info["type"] = "v4l2loopback"
            elif "obs" in driver.lower():
                info["type"] = "obs_virtual"
            elif "manycam" in driver.lower() or "manycam" in name.lower():
                info["type"] = "manycam"
            elif caps[4] & V4L2_CAP_VIDEO_OUTPUT:
                info["type"] = "virtual_output"
            else:
                info["type"] = "capture"
        except (OSError, PermissionError):
            info["type"] = "inaccessible"
        finally:
            if fd >= 0:
                try:
                    os.close(fd)
                except OSError:
                    pass
        cameras.append(info)

    if cameras:
        return cameras

    cameras.append(
        {
            "device": "pyvirtualcam",
            "name": "pyvirtualcam (ManyCam/OBS/Virtual Camera)",
            "type": "virtual",
            "driver": "pyvirtualcam",
        }
    )
    return cameras
