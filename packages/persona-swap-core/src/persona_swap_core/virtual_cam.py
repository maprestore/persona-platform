from __future__ import annotations

import os
import struct
import fcntl
import threading
import time
import sys
from pathlib import Path

import numpy as np
import numpy.typing as npt


V4L2_CAP_VIDEO_OUTPUT = 0x00000001
VIDIOC_QUERYCAP = 0x80685600

CAMERA_DEVICES = [f"/dev/video{i}" for i in range(16)]


class VirtualCamera:
    def __init__(self, name: str = "Persona Camera", width: int = 1280, height: int = 720, fps: int = 30):
        self.name = name
        self.width = width
        self.height = height
        self.fps = fps
        self._running = False
        self._cam = None
        self._backend = None

    def start(self) -> bool:
        backends = []

        if sys.platform == "linux":
            backends.append(("V4L2", self._start_v4l2))

        backends.append(("pyvirtualcam", self._start_pyvirtualcam))

        for name, func in backends:
            try:
                if func():
                    self._backend = name
                    self._running = True
                    return True
            except Exception:
                continue

        return False

    def _start_v4l2(self) -> bool:
        for dev in CAMERA_DEVICES:
            if not os.path.exists(dev):
                continue
            try:
                fd = os.open(dev, os.O_RDWR | os.O_NONBLOCK)
                cap = struct.pack("I32s32s32s2I", 0, b"", b"", b"", 0, 0)
                result = fcntl.ioctl(fd, VIDIOC_QUERYCAP, cap)
                caps = struct.unpack("I32s32s32s2I", result)
                os.close(fd)

                if caps[4] & V4L2_CAP_VIDEO_OUTPUT:
                    self._cam = V4L2VirtualCamera(dev, self.width, self.height, self.fps)
                    return self._cam.start()
            except (OSError, PermissionError, IOError):
                continue
        return False

    def _start_pyvirtualcam(self) -> bool:
        import pyvirtualcam
        self._cam = pyvirtualcam.Camera(
            name=self.name,
            width=self.width,
            height=self.height,
            fps=self.fps,
        )
        return True

    def send(self, frame: npt.NDArray[np.uint8]) -> bool:
        if not self._running or self._cam is None:
            return False
        try:
            if frame.shape[:2] != (self.height, self.width):
                import cv2
                frame = cv2.resize(frame, (self.width, self.height))

            if self._backend == "V4L2":
                return self._cam.send(frame)
            else:
                if frame.shape[2] == 3:
                    self._cam.send(frame)
                return True
        except Exception:
            return False

    def stop(self) -> None:
        self._running = False
        if self._cam is not None:
            try:
                if self._backend == "V4L2":
                    self._cam.stop()
                else:
                    self._cam.close()
            except Exception:
                pass
            self._cam = None

    def is_running(self) -> bool:
        return self._running

    def __del__(self) -> None:
        self.stop()


class V4L2VirtualCamera:
    def __init__(self, device: str = "/dev/video0", width: int = 1280, height: int = 720, fps: int = 30):
        self.device = device
        self.width = width
        self.height = height
        self.fps = fps
        self._fd = -1
        self._running = False

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
            2, self.width, self.height, 0x59455247, 0, 0, 0, 0,
            b"\x00" * 16, 0, 0, 0, 0, 0, 0, 0,
        )
        try:
            fcntl.ioctl(self._fd, 0xC0CC5605, fmt)
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
                import cv2
                frame = cv2.resize(frame, (self.width, self.height))

            if len(frame.shape) == 3 and frame.shape[2] == 3:
                import cv2
                frame = cv2.cvtColor(frame, cv2.COLOR_RGB2YUV420)

            os.write(self._fd, frame.tobytes())
            return True
        except (OSError, IOError):
            return False

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
        self._cameras: dict[str, VirtualCamera] = {}
        self._active: str | None = None

    def detect_cameras(self) -> list[dict]:
        cameras = []
        for dev in CAMERA_DEVICES:
            if os.path.exists(dev):
                info = {"device": dev, "name": f"Camera {dev}", "type": "unknown", "driver": ""}
                try:
                    fd = os.open(dev, os.O_RDWR | os.O_NONBLOCK)
                    cap = struct.pack("I32s32s32s2I", 0, b"", b"", b"", 0, 0)
                    result = fcntl.ioctl(fd, VIDIOC_QUERYCAP, cap)
                    caps = struct.unpack("I32s32s32s2I", result)
                    info["driver"] = caps[1].rstrip(b"\x00").decode("utf-8", errors="replace")
                    info["name"] = caps[2].rstrip(b"\x00").decode("utf-8", errors="replace")
                    os.close(fd)

                    if "loopback" in info["driver"].lower():
                        info["type"] = "v4l2loopback"
                    elif "obs" in info["driver"].lower():
                        info["type"] = "obs_virtual"
                    elif caps[4] & V4L2_CAP_VIDEO_OUTPUT:
                        info["type"] = "virtual_output"
                    else:
                        info["type"] = "capture"
                except (OSError, PermissionError):
                    info["type"] = "inaccessible"
                cameras.append(info)

        if sys.platform != "linux":
            cameras.append({
                "device": "pyvirtualcam",
                "name": "pyvirtualcam (ManyCam/OBS)",
                "type": "virtual",
                "driver": "pyvirtualcam",
            })

        return cameras

    def create_camera(self, name: str = "Persona Camera", width: int = 1280, height: int = 720, fps: int = 30) -> VirtualCamera:
        cam = VirtualCamera(name, width, height, fps)
        self._cameras[name] = cam
        return cam

    def get_camera(self, name: str) -> VirtualCamera | None:
        return self._cameras.get(name)

    def set_active(self, name: str) -> bool:
        if name in self._cameras:
            self._active = name
            return True
        return False

    def get_active(self) -> VirtualCamera | None:
        if self._active:
            return self._cameras.get(self._active)
        return None

    def list_outputs(self) -> list[dict]:
        outputs = self.detect_cameras()
        return [c for c in outputs if c["type"] in ("virtual_output", "v4l2loopback", "obs_virtual", "virtual")]

    def stop_all(self) -> None:
        for cam in self._cameras.values():
            cam.stop()
        self._cameras.clear()
        self._active = None
