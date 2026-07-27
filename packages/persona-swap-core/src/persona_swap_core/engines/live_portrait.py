from __future__ import annotations

import numpy as np
import numpy.typing as npt


class LivePortraitEngine:
    def __init__(self) -> None:
        self._model = None
        self._device = "cpu"
        self._loaded = False
        self._device_torch = None

    def load(self, device: str = "cuda") -> None:
        self._device = device
        self._loaded = True
        try:
            import torch
            self._device_torch = torch.device(device)
        except ImportError:
            self._device_torch = None

    def animate(
        self,
        source_image: npt.NDArray[np.uint8],
        driving_video: list[npt.NDArray[np.uint8]] | None = None,
        expression: str = "smile",
        intensity: float = 1.0,
    ) -> list[npt.NDArray[np.uint8]]:
        if not self._loaded:
            return [source_image]

        if driving_video:
            return self._animate_with_driving(source_image, driving_video, intensity)
        return self._animate_with_expression(source_image, expression, intensity)

    def _animate_with_driving(
        self,
        source: npt.NDArray[np.uint8],
        driving: list[npt.NDArray[np.uint8]],
        intensity: float,
    ) -> list[npt.NDArray[np.uint8]]:
        results = []
        try:
            import cv2
            source_gray = cv2.cvtColor(source, cv2.COLOR_RGB2GRAY) if len(source.shape) == 3 else source
            source_pts = self._detect_face_landmarks(source_gray)

            if source_pts is None:
                return [source] * len(driving)

            for frame in driving:
                frame_gray = cv2.cvtColor(frame, cv2.COLOR_RGB2GRAY) if len(frame.shape) == 3 else frame
                frame_pts = self._detect_face_landmarks(frame_gray)

                if frame_pts is not None and source_pts is not None:
                    result = self._warp_face(source, source_pts, frame_pts, intensity)
                    results.append(result)
                else:
                    results.append(source.copy())

            return results
        except ImportError:
            return [source] * len(driving)

    def _animate_with_expression(
        self,
        source: npt.NDArray[np.uint8],
        expression: str,
        intensity: float,
    ) -> list[npt.NDArray[np.uint8]]:
        num_frames = 30
        results = []
        try:
            import cv2
            h, w = source.shape[:2]
            source_gray = cv2.cvtColor(source, cv2.COLOR_RGB2GRAY) if len(source.shape) == 3 else source

            if expression == "smile":
                for i in range(num_frames):
                    t = (i / num_frames) * 2 * np.pi
                    factor = (np.sin(t) * 0.5 + 0.5) * intensity
                    result = self._apply_smile(source, factor)
                    results.append(result)
            elif expression == "wink":
                for i in range(num_frames):
                    t = (i / num_frames) * 2 * np.pi
                    factor = (np.sin(t) * 0.5 + 0.5) * intensity
                    result = self._apply_wink(source, factor)
                    results.append(result)
            elif expression == "head_turn":
                for i in range(num_frames):
                    angle = ((i / num_frames) * 2 - 1) * 15 * intensity
                    center = (w // 2, h // 2)
                    M = cv2.getRotationMatrix2D(center, angle, 1.0)
                    result = cv2.warpAffine(source, M, (w, h))
                    results.append(result)
            elif expression == "nod":
                for i in range(num_frames):
                    t = (i / num_frames) * 2 * np.pi
                    dx = int(np.sin(t) * 10 * intensity)
                    M = np.float32([[1, 0, dx], [0, 1, 0]])
                    result = cv2.warpAffine(source, M, (w, h))
                    results.append(result)
            else:
                return [source] * num_frames

            return results
        except ImportError:
            return [source] * num_frames

    def _detect_face_landmarks(self, gray: npt.NDArray[np.uint8]) -> npt.NDArray | None:
        try:
            import cv2
            face_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            )
            faces = face_cascade.detectMultiScale(gray, 1.1, 5)

            if len(faces) == 0:
                return None

            x, y, w, h = faces[0]
            # Return landmarks-like structure: 5 key points (left_eye, right_eye, nose, left_mouth, right_mouth)
            # Using face bbox to approximate
            landmarks = np.array([
                [x + w * 0.3, y + h * 0.35],  # left eye
                [x + w * 0.7, y + h * 0.35],  # right eye
                [x + w * 0.5, y + h * 0.55],  # nose
                [x + w * 0.35, y + h * 0.75], # left mouth
                [x + w * 0.65, y + h * 0.75], # right mouth
            ], dtype=np.float32)
            return landmarks
        except Exception:
            return None

    def _warp_face(
        self,
        source: npt.NDArray[np.uint8],
        src_pts: npt.NDArray,
        dst_pts: npt.NDArray,
        intensity: float,
    ) -> npt.NDArray[np.uint8]:
        try:
            import cv2
            # src_pts and dst_pts are now 5 landmarks each
            # Create source rect from landmarks (bounding box of landmarks)
            src_x = src_pts[:, 0]
            src_y = src_pts[:, 1]
            sx, sy = src_x.min(), src_y.min()
            sw, sh = src_x.max() - sx, src_y.max() - sy
            
            dst_x = dst_pts[:, 0]
            dst_y = dst_pts[:, 1]
            dx, dy = dst_x.min(), dst_y.min()
            dw, dh = dst_x.max() - dx, dst_y.max() - dy
            
            # Use landmarks directly for perspective transform
            # Take 4 corners from the 5 landmarks (left_eye, right_eye, left_mouth, right_mouth)
            src_rect = np.array([
                src_pts[0],  # left eye
                src_pts[1],  # right eye
                src_pts[3],  # left mouth
                src_pts[4],  # right mouth
            ], dtype=np.float32)
            
            dst_rect = np.array([
                dst_pts[0],
                dst_pts[1],
                dst_pts[3],
                dst_pts[4],
            ], dtype=np.float32)
            
            # Blend towards destination
            blended_rect = dst_rect * intensity + src_rect * (1 - intensity)

            matrix = cv2.getPerspectiveTransform(src_rect, blended_rect)
            result = cv2.warpPerspective(source, matrix, (source.shape[1], source.shape[0]))
            return result
        except Exception:
            return source.copy()

    def _apply_smile(self, img: npt.NDArray[np.uint8], factor: float) -> npt.NDArray[np.uint8]:
        return self._apply_lip_stretch(img, factor)

    def _apply_wink(self, img: npt.NDArray[np.uint8], factor: float) -> npt.NDArray[np.uint8]:
        result = img.copy()
        h, w = result.shape[:2]
        try:
            import cv2
            eye_center = (int(w * 0.35), int(h * 0.35))
            eye_radius = int(min(w, h) * 0.08)
            eye_mask = np.zeros((h, w), dtype=np.uint8)
            cv2.circle(eye_mask, eye_center, eye_radius, 255, -1)

            close_amount = int(eye_radius * factor * 0.8)
            if close_amount > 0:
                cv2.rectangle(
                    result,
                    (eye_center[0] - eye_radius, eye_center[1] - close_amount),
                    (eye_center[0] + eye_radius, eye_center[1] + close_amount),
                    (result[eye_center[1], eye_center[0]]).tolist(),
                    -1,
                )
        except Exception:
            pass
        return result

    def _apply_lip_stretch(self, img: npt.NDArray[np.uint8], factor: float) -> npt.NDArray[np.uint8]:
        result = img.copy()
        h, w = result.shape[:2]
        try:
            import cv2
            mouth_center = (int(w * 0.5), int(h * 0.62))
            mouth_w = int(w * 0.15)
            mouth_h = int(h * 0.04)

            stretch = int(mouth_h * factor)
            if stretch > 0:
                src_tri = np.float32([
                    [mouth_center[0] - mouth_w, mouth_center[1] - mouth_h],
                    [mouth_center[0] + mouth_w, mouth_center[1] - mouth_h],
                    [mouth_center[0], mouth_center[1] + mouth_h],
                ])
                dst_tri = np.float32([
                    [mouth_center[0] - mouth_w, mouth_center[1] - mouth_h - stretch // 2],
                    [mouth_center[0] + mouth_w, mouth_center[1] - mouth_h - stretch // 2],
                    [mouth_center[0], mouth_center[1] + mouth_h + stretch // 2],
                ])
                warp_mat = cv2.getAffineTransform(src_tri, dst_tri)
                result = cv2.warpAffine(result, warp_mat, (w, h))
        except Exception:
            pass
        return result

    def unload(self) -> None:
        self._model = None
        self._loaded = False
