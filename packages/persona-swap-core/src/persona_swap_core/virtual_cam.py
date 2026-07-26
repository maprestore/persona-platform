from __future__ import annotations

import os
import struct
import fcntl
import mmap
import threading
import time
from pathlib import Path

import numpy as np
import numpy.typing as npt


V4L2_CAP_VIDEO_OUTPUT = 0x00000001
V4L2_CAP_STREAMING = 0x04000000
V4L2_MEMORY_MMAP = 1
V4L2_BUF_TYPE_VIDEO_OUTPUT = 2
V4L2_FIELD_NONE = 1
V4L2_FIELD_ANY = 0
VIDIOC_QUERYCAP = 0x80685600
VIDIOC_S_FMT = 0xC0CC5605
VIDIOC_REQBUFS = 0xC0145608
VIDIOC_QUERYBUF = 0xC0445609
VIDIOC_QBUF = 0xC044560F
VIDIOC_DQBUF = 0xC0445611
VIDIOC_STREAMON = 0x40045612
VIDIOC_STREAMOFF = 0x40045613
VIDIOC_ENUM_FRAMESIZES = 0xC02C564A
VIDIOC_ENUM_FRAMEINTERVALS = 0xC024564B

CAMERA_DEVICES = [
    "/dev/video0", "/dev/video1", "/dev/video2", "/dev/video3",
    "/dev/video4", "/dev/video5", "/dev/video6", "/dev/video7",
    "/dev/video8", "/dev/video9", "/dev/video10", "/dev/video11",
]


class V4L2VirtualCamera:
    def __init__(self, device: str = "/dev/video0", width: int = 1280, height: int = 720, fps: int = 30):
        self.device = device
        self.width = width
        self.height = height
        self.fps = fps
        self._fd = -1
        self._buffers = []
        self._running = False
        self._thread: threading.Thread | None = None
        self._frame_queue: list[npt.NDArray[np.uint8]] = []
        self._lock = threading.Lock()

    def is_available(self) -> bool:
        return os.path.exists(self.device)

    def _open_device(self) -> bool:
        try:
            self._fd = os.open(self.device, os.O_RDWR | os.O_NONBLOCK)
            cap = struct.pack("I32s32s32s2I", 0, b"", b"", b"", 0, 0)
            result = fcntl.ioctl(self._fd, VIDIOC_QUERYCAP, cap)
            caps = struct.unpack("I32s32s32s2I", result)
            if not (caps[4] & V4L2_CAP_VIDEO_OUTPUT):
                self._close_device()
                return False
            return True
        except (OSError, PermissionError):
            return False

    def _set_format(self) -> bool:
        fmt = struct.pack(
            "IIIIIIiI16sIIiIIiI",
            V4L2_BUF_TYPE_VIDEO_OUTPUT,
            self.width,
            self.height,
            0x59455247,
            0,
            0,
            0,
            0,
            b"\x00" * 16,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
        )
        try:
            result = fcntl.ioctl(self._fd, VIDIOC_S_FMT, fmt)
            return True
        except (OSError, IOError):
            return False

    def start(self) -> bool:
        if not self.is_available():
            return False
        if not self._open_device():
            return False
        if not self._set_format():
            self._close_device()
            return False
        self._running = True
        return True

    def send(self, frame: npt.NDArray[np.uint8]) -> bool:
        if not self._running:
            return False
        try:
            if frame.shape[:2] != (self.height, self.width):
                try:
                    import cv2
                    frame = cv2.resize(frame, (self.width, self.height))
                except ImportError:
                    from PIL import Image
                    img = Image.fromarray(frame)
                    img = img.resize((self.width, self.height))
                    frame = np.array(img)

            if len(frame.shape) == 3 and frame.shape[2] == 3:
                try:
                    import cv2
                    frame = cv2.cvtColor(frame, cv2.COLOR_RGB2YUV420)
                except ImportError:
                    frame = self._rgb_to_yuv420(frame)

            data = frame.tobytes()
            os.write(self._fd, data)
            return True
        except (OSError, IOError):
            return False

    def _rgb_to_yuv420(self, rgb: npt.NDArray[np.uint8]) -> npt.NDArray[np.uint8]:
        h, w = rgb.shape[:2]
        yuv = np.zeros((h * 3 // 2, w), dtype=np.uint8)
        r, g, b = rgb[:, :, 0].astype(float), rgb[:, :, 1].astype(float), rgb[:, :, 2].astype(float)
        yuv[:h, :] = np.clip(0.299 * r + 0.587 * g + 0.114 * b, 0, 255).astype(np.uint8)
        cb = np.clip(128 - 0.168736 * r - 0.331264 * g + 0.5 * b, 0, 255)
        cr = np.clip(128 + 0.5 * r - 0.418688 * g - 0.081312 * b, 0, 255)
        yuv[h::2, ::2] = cb[::2, ::2].astype(np.uint8)
        yuv[h::2, 1::2] = cb[::2, 1::2].astype(np.uint8)
        yuv[h + 1::2, ::2] = cb[1::2, ::2].astype(np.uint8)
        yuv[h + 1::2, 1::2] = cb[1::2, 1::2].astype(np.uint8)
        yuv[h // 2::2, ::2] = cr[::2, ::2].astype(np.uint8)
        yuv[h // 2::2, 1::2] = cr[::2, 1::2].astype(np.uint8)
        yuv[h // 2 + 1::2, ::2] = cr[1::2, ::2].astype(np.uint8)
        yuv[h // 2 + 1::2, 1::2] = cr[1::2, 1::2].astype(np.uint8)
        return yuv

    def stop(self) -> None:
        self._running = False
        self._close_device()

    def _close_device(self) -> None:
        try:
            if self._fd >= 0:
                os.close(self._fd)
                self._fd = -1
        except OSError:
            pass

    def __del__(self) -> None:
        self.stop()


class VirtualCameraManager:
    def __init__(self) -> None:
        self._cameras: dict[str, V4L2VirtualCamera] = {}
        self._active: str | None = None

    def detect_cameras(self) -> list[dict]:
        cameras = []
        for dev in CAMERA_DEVICES:
            if os.path.exists(dev):
                info = {"device": dev, "name": f"Camera {dev}", "type": "unknown"}
                try:
                    fd = os.open(dev, os.O_RDWR | os.O_NONBLOCK)
                    cap = struct.pack("I32s32s32s2I", 0, b"", b"", b"", 0, 0)
                    result = fcntl.ioctl(fd, VIDIOC_QUERYCAP, cap)
                    caps = struct.unpack("I32s32s32s2I", result)
                    driver = caps[1].rstrip(b"\x00").decode("utf-8", errors="replace")
                    name = caps[2].rstrip(b"\x00").decode("utf-8", errors="replace")
                    info["driver"] = driver
                    info["name"] = name or f"V4L2 Device {dev}"

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

                    os.close(fd)
                except (OSError, PermissionError):
                    info["type"] = "inaccessible"

                cameras.append(info)
        return cameras

    def create_camera(
        self, device: str = "/dev/video0", width: int = 1280, height: int = 720, fps: int = 30
    ) -> V4L2VirtualCamera:
        cam = V4L2VirtualCamera(device, width, height, fps)
        self._cameras[device] = cam
        return cam

    def get_camera(self, device: str) -> V4L2VirtualCamera | None:
        return self._cameras.get(device)

    def set_active(self, device: str) -> bool:
        if device in self._cameras or os.path.exists(device):
            self._active = device
            return True
        return False

    def get_active(self) -> V4L2VirtualCamera | None:
        if self._active:
            return self._cameras.get(self._active)
        return None

    def list_outputs(self) -> list[dict]:
        outputs = []
        cameras = self.detect_cameras()
        for cam in cameras:
            if cam["type"] in ("virtual_output", "v4l2loopback", "obs_virtual", "manycam"):
                outputs.append(cam)
        if not outputs:
            for dev in CAMERA_DEVICES:
                if os.path.exists(dev):
                    outputs.append({"device": dev, "name": f"Output {dev}", "type": "v4l2"})
        return outputs

    def stop_all(self) -> None:
        for cam in self._cameras.values():
            cam.stop()
        self._cameras.clear()
        self._active = None
