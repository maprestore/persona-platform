from __future__ import annotations

import numpy as np
from shared.types import VideoFrame, BodyPose


class VideoAnimator:
    def __init__(self) -> None:
        self._loaded = False
        self._avatar = None
        self._motion_data: list[dict] = []

    def load(self, avatar_path: str | None = None) -> None:
        self._loaded = True
        if avatar_path:
            try:
                import cv2
                self._avatar = cv2.imread(avatar_path)
            except (ImportError, Exception):
                self._avatar = None

    def drive(self, frame: VideoFrame, pose: BodyPose | None = None) -> VideoFrame:
        if not self._loaded:
            return frame

        if pose is None:
            pose = self._detect_pose(frame)

        if pose is None:
            return frame

        result = frame.image.copy()
        try:
            import cv2
            for kp, score in zip(pose.keypoints, pose.scores):
                if score > 0.3:
                    x, y = int(kp[0]), int(kp[1])
                    cv2.circle(result, (x, y), 4, (0, 255, 0), -1)
        except ImportError:
            pass

        return VideoFrame(image=result, timestamp=frame.timestamp)

    def _detect_pose(self, frame: VideoFrame) -> BodyPose | None:
        try:
            import cv2
            img = frame.image
            gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY) if len(img.shape) == 3 else img
            edges = cv2.Canny(gray, 50, 150)
            contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            keypoints = []
            scores = []
            for cnt in contours[:15]:
                M = cv2.moments(cnt)
                if M["m00"] > 0:
                    cx = int(M["m10"] / M["m00"])
                    cy = int(M["m01"] / M["m00"])
                    keypoints.append([float(cx), float(cy)])
                    scores.append(float(min(1.0, M["m00"] / 10000)))

            if not keypoints:
                h, w = img.shape[:2]
                keypoints = [[w / 2, h / 2]]
                scores = [0.5]

            return BodyPose(keypoints=keypoints, scores=scores)
        except ImportError:
            return None

    def animate_sequence(
        self, frames: list[VideoFrame], fps: int = 30
    ) -> list[VideoFrame]:
        result = []
        for i, frame in enumerate(frames):
            time_offset = i / fps
            pose = self._generate_motion_pose(frame, time_offset)
            result.append(self.drive(frame, pose))
        return result

    def _generate_motion_pose(self, frame: VideoFrame, time_offset: float) -> BodyPose:
        h, w = frame.image.shape[:2]
        cx, cy = w / 2, h / 2
        import math
        keypoints = []
        scores = []
        for i in range(5):
            angle = time_offset * 2 + i * 0.5
            x = cx + 50 * math.cos(angle + i)
            y = cy + 50 * math.sin(angle + i * 0.7)
            keypoints.append([float(x), float(y)])
            scores.append(0.8)
        return BodyPose(keypoints=keypoints, scores=scores)

    def unload(self) -> None:
        self._loaded = False
        self._avatar = None
        self._motion_data = []
