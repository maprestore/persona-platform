"""
Advanced Tracking Engine
========================
Real-time head pose, facial expression, hand tracking, and lip sync.
Uses InsightFace landmarks, MediaPipe Hands, Kalman filtering, and custom expression transfer.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Optional, Tuple, List

import numpy as np
import numpy.typing as npt

logger = logging.getLogger(__name__)

# Try to import filterpy for Kalman filtering
try:
    from filterpy.kalman import KalmanFilter
    HAS_FILTERPY = True
except ImportError:
    HAS_FILTERPY = False
    logger.info("filterpy not available, using EMA smoothing")


@dataclass
class HeadPose:
    """Head pose estimation results."""
    pitch: float = 0.0  # Up/down rotation (-90 to 90 degrees)
    yaw: float = 0.0    # Left/right rotation (-90 to 90 degrees)
    roll: float = 0.0   # Tilt rotation (-180 to 180 degrees)
    position: Tuple[float, float] = (0.0, 0.0)  # Center position (normalized)
    confidence: float = 0.0


@dataclass
class FacialExpression:
    """Facial expression analysis results."""
    mouth_open: float = 0.0      # 0.0 closed, 1.0 fully open
    mouth_smile: float = 0.0     # 0.0 neutral, 1.0 full smile
    eyebrow_raise: float = 0.0   # 0.0 neutral, 1.0 fully raised
    eye_open_left: float = 1.0   # 0.0 closed, 1.0 open
    eye_open_right: float = 1.0  # 0.0 closed, 1.0 open
    gaze: Tuple[float, float] = (0.0, 0.0)  # Gaze direction (x, y)


@dataclass
class HandLandmarks:
    """Hand tracking results."""
    landmarks: npt.NDArray = field(default_factory=lambda: np.zeros((21, 3)))
    handedness: str = "Right"  # "Left" or "Right"
    confidence: float = 0.0
    gesture: str = "unknown"


@dataclass
class TrackingState:
    """Complete tracking state for a frame."""
    head_pose: HeadPose = field(default_factory=HeadPose)
    expression: FacialExpression = field(default_factory=FacialExpression)
    left_hand: Optional[HandLandmarks] = None
    right_hand: Optional[HandLandmarks] = None
    timestamp: float = 0.0
    frame_id: int = 0


class AdvancedTrackingEngine:
    """
    Real-time tracking engine combining:
    - Head pose estimation (6-point landmarks from InsightFace)
    - Facial expression analysis (mouth, eyes, eyebrows)
    - Hand tracking (MediaPipe Hands)
    - Expression transfer for live animation
    """

    def __init__(self) -> None:
        self._face_detector = None
        self._hand_detector = None
        self._expression_model = None
        self._device = "cpu"
        self._loaded = False
        self._frame_count = 0
        self._prev_head_pose: Optional[HeadPose] = None
        self._prev_expression: Optional[FacialExpression] = None
        self._smoothing_factor = 0.7  # EMA fallback smoothing

        # Kalman filters for temporal consistency
        self._kf_head_pose: Optional[object] = None
        self._kf_expression: Optional[object] = None
        self._kalman_initialized = False

        # 3D model points for head pose estimation (average face model)
        self._model_points = np.array([
            [0.0, 0.0, 0.0],          # Nose tip
            [0.0, -330.0, -65.0],      # Chin
            [-225.0, 170.0, -135.0],   # Left eye left corner
            [225.0, 170.0, -135.0],    # Right eye right corner
            [-150.0, -150.0, -125.0],  # Left mouth corner
            [150.0, -150.0, -125.0],   # Right mouth corner
        ], dtype=np.float64)

    def load(self, device: str = "cpu") -> None:
        """Initialize all tracking components."""
        self._device = device
        try:
            self._init_face_detector()
            self._init_hand_detector()
            self._init_kalman_filters()
            self._loaded = True
        except Exception as e:
            logger.warning("AdvancedTracking load warning: %s", e)
            self._loaded = True  # Still usable with limited features

    def _init_kalman_filters(self) -> None:
        """Initialize Kalman filters for head pose and expression smoothing."""
        if not HAS_FILTERPY:
            return

        # Head pose Kalman filter: [pitch, yaw, roll, pos_x, pos_y]
        self._kf_head_pose = KalmanFilter(dim_x=5, dim_z=5)
        self._kf_head_pose.F = np.eye(5)  # State transition
        self._kf_head_pose.H = np.eye(5)  # Measurement
        self._kf_head_pose.P *= 1000.0    # Covariance
        self._kf_head_pose.R = np.eye(5) * 0.1   # Measurement noise
        self._kf_head_pose.Q = np.eye(5) * 0.01  # Process noise

        # Expression Kalman filter: [mouth_open, smile, eyebrow, eye_L, eye_R]
        self._kf_expression = KalmanFilter(dim_x=5, dim_z=5)
        self._kf_expression.F = np.eye(5)
        self._kf_expression.H = np.eye(5)
        self._kf_expression.P *= 1000.0
        self._kf_expression.R = np.eye(5) * 0.1
        self._kf_expression.Q = np.eye(5) * 0.01

        self._kalman_initialized = True
        logger.info("Kalman filters initialized for temporal smoothing")

    def _init_face_detector(self) -> None:
        """Initialize face detector with InsightFace."""
        try:
            import insightface
            from insightface.app import FaceAnalysis
            providers = (
                ["CUDAExecutionProvider", "CPUExecutionProvider"]
                if self._device == "cuda"
                else ["CPUExecutionProvider"]
            )
            import os
            root = os.path.join(os.path.expanduser("~"), ".insightface", "models")
            self._face_detector = FaceAnalysis(name="buffalo_1", root=root, download=False, providers=providers)
            self._face_detector.prepare(ctx_id=0 if self._device == "cuda" else -1)
        except ImportError:
            logger.info("InsightFace not available, using fallback")
            self._face_detector = None

    def _init_hand_detector(self) -> None:
        """Initialize MediaPipe Hands for hand tracking."""
        try:
            import mediapipe as mp
            self._hand_detector = mp.solutions.hands.Hands(
                static_image_mode=False,
                max_num_hands=2,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5,
            )
        except ImportError:
            logger.info("MediaPipe not available, hand tracking disabled")
            self._hand_detector = None

    def process_frame(
        self,
        frame: npt.NDArray[np.uint8],
        source_face_embedding: Optional[npt.NDArray] = None,
    ) -> TrackingState:
        """
        Process a single frame and return complete tracking state.

        Args:
            frame: RGB image (H, W, 3)
            source_face_embedding: Optional source face for expression transfer

        Returns:
            TrackingState with all tracking data
        """
        state = TrackingState(
            timestamp=time.time(),
            frame_id=self._frame_count,
        )
        self._frame_count += 1

        if not self._loaded:
            return state

        # Detect face and extract landmarks
        face_data = self._detect_face(frame)
        if face_data is not None:
            landmarks, bbox, embedding = face_data
            state.head_pose = self._estimate_head_pose(landmarks, frame.shape)
            state.expression = self._analyze_expression(landmarks, frame.shape)

            # Apply temporal smoothing
            if self._prev_head_pose is not None:
                state.head_pose = self._smooth_head_pose(
                    state.head_pose, self._prev_head_pose
                )
            if self._prev_expression is not None:
                state.expression = self._smooth_expression(
                    state.expression, self._prev_expression
                )

            self._prev_head_pose = state.head_pose
            self._prev_expression = state.expression

        # Detect hands
        if self._hand_detector is not None:
            hands = self._detect_hands(frame)
            if len(hands) >= 1:
                state.left_hand = hands[0]
            if len(hands) >= 2:
                state.right_hand = hands[1]

        return state

    def _detect_face(self, frame: npt.NDArray[np.uint8]):
        """Detect face and return landmarks, bbox, and embedding."""
        if self._face_detector is None:
            return self._fallback_face_detection(frame)

        try:
            faces = self._face_detector.get(frame)
            if not faces:
                return None

            face = faces[0]
            # InsightFace returns 5 landmarks: left_eye, right_eye, nose, left_mouth, right_mouth
            landmarks = face.landmark_2d_106 if hasattr(face, 'landmark_2d_106') else face.landmark
            if landmarks is None:
                landmarks = face.kps

            return landmarks, face.bbox, face.embedding
        except Exception:
            return self._fallback_face_detection(frame)

    def _fallback_face_detection(self, frame: npt.NDArray[np.uint8]):
        """Fallback face detection using OpenCV Haar cascade."""
        try:
            import cv2
            gray = cv2.cvtColor(frame, cv2.COLOR_RGB2GRAY)
            face_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            )
            faces = face_cascade.detectMultiScale(gray, 1.1, 5, minSize=(50, 50))

            if len(faces) == 0:
                return None

            x, y, w, h = faces[0]
            # Create 5-point landmarks from bounding box
            landmarks = np.array([
                [x + w * 0.3, y + h * 0.35],   # left eye
                [x + w * 0.7, y + h * 0.35],   # right eye
                [x + w * 0.5, y + h * 0.55],   # nose
                [x + w * 0.35, y + h * 0.75],  # left mouth
                [x + w * 0.65, y + h * 0.75],  # right mouth
            ], dtype=np.float32)

            bbox = np.array([x, y, x + w, y + h], dtype=np.float32)
            return landmarks, bbox, None
        except Exception:
            return None

    def _estimate_head_pose(
        self,
        landmarks: npt.NDArray,
        frame_shape: Tuple[int, ...],
    ) -> HeadPose:
        """
        Estimate head pose from facial landmarks using PnP solver.
        """
        pose = HeadPose()

        try:
            import cv2

            h, w = frame_shape[:2]

            # Get 2D image points from landmarks
            if len(landmarks.shape) == 3:
                landmarks = landmarks.reshape(-1, 2)

            # Use 6 key points if available, otherwise approximate
            if len(landmarks) >= 6:
                image_points = np.array([
                    landmarks[33],   # Nose tip (index 33 in 68-point model)
                    landmarks[8],    # Chin
                    landmarks[36],   # Left eye left corner
                    landmarks[45],   # Right eye right corner
                    landmarks[48],   # Left mouth corner
                    landmarks[54],   # Right mouth corner
                ], dtype=np.float64)
            elif len(landmarks) >= 5:
                image_points = np.array([
                    landmarks[2],    # Nose
                    [landmarks[0][0], landmarks[2][1] + (landmarks[2][1] - landmarks[0][1])],  # Chin approximation
                    landmarks[0],    # Left eye
                    landmarks[1],    # Right eye
                    landmarks[3],    # Left mouth
                    landmarks[4],    # Right mouth
                ], dtype=np.float64)
            else:
                return pose

            # Camera internals
            focal_length = w
            center = (w / 2, h / 2)
            camera_matrix = np.array([
                [focal_length, 0, center[0]],
                [0, focal_length, center[1]],
                [0, 0, 1],
            ], dtype=np.float64)

            dist_coeffs = np.zeros((4, 1))

            # Solve PnP
            success, rotation_vec, translation_vec = cv2.solvePnP(
                self._model_points,
                image_points,
                camera_matrix,
                dist_coeffs,
                flags=cv2.SOLVEPNP_ITERATIVE,
            )

            if success:
                # Convert rotation vector to Euler angles
                rotation_mat, _ = cv2.Rodrigues(rotation_vec)
                pose_mat = np.hstack((rotation_mat, translation_vec))
                _, _, _, _, _, _, euler = cv2.decomposeProjectionMatrix(
                    np.vstack((pose_mat, [0, 0, 0, 1]))
                )

                pose.pitch = float(euler[0][0][0])
                pose.yaw = float(euler[1][0][0])
                pose.roll = float(euler[2][0][0])

                # Normalize position
                nose_tip = image_points[0]
                pose.position = (float(nose_tip[0] / w), float(nose_tip[1] / h))
                pose.confidence = 0.9

        except Exception:
            pass

        return pose

    def _analyze_expression(
        self,
        landmarks: npt.NDArray,
        frame_shape: Tuple[int, ...],
    ) -> FacialExpression:
        """
        Analyze facial expression from landmarks.
        """
        expr = FacialExpression()

        try:
            h, w = frame_shape[:2]

            if len(landmarks.shape) == 3:
                landmarks = landmarks.reshape(-1, 2)

            if len(landmarks) < 5:
                return expr

            # Calculate mouth openness (distance between upper and lower lip)
            if len(landmarks) >= 68:
                # 68-point model
                upper_lip = landmarks[51]  # Top of upper lip
                lower_lip = landmarks[57]  # Bottom of lower lip
                mouth_width = landmarks[54][0] - landmarks[48][0]
                mouth_center_y = (landmarks[51][1] + landmarks[57][1]) / 2

                # Mouth openness ratio
                lip_distance = abs(lower_lip[1] - upper_lip[1])
                expr.mouth_open = min(1.0, lip_distance / (mouth_width * 0.3 + 1e-6))

                # Smile detection (mouth corners relative to center)
                left_corner = landmarks[48]
                right_corner = landmarks[54]
                corner_avg_y = (left_corner[1] + right_corner[1]) / 2
                expr.mouth_smile = max(0.0, min(1.0, (mouth_center_y - corner_avg_y) / (mouth_width * 0.1 + 1e-6)))

                # Eye openness
                left_eye_top = landmarks[37]
                left_eye_bot = landmarks[41]
                left_eye_width = landmarks[39][0] - landmarks[36][0]
                expr.eye_open_left = min(1.0, abs(left_eye_bot[1] - left_eye_top[1]) / (left_eye_width * 0.3 + 1e-6))

                right_eye_top = landmarks[43]
                right_eye_bot = landmarks[47]
                right_eye_width = landmarks[45][0] - landmarks[42][0]
                expr.eye_open_right = min(1.0, abs(right_eye_bot[1] - right_eye_top[1]) / (right_eye_width * 0.3 + 1e-6))

                # Eyebrow raise
                left_brow = landmarks[27]  # Middle of eyebrows
                left_eye_center = (landmarks[36][1] + landmarks[39][1]) / 2
                brow_distance = left_eye_center - left_brow[1]
                expr.eyebrow_raise = min(1.0, max(0.0, brow_distance / (left_eye_width * 0.5 + 1e-6)))

            elif len(landmarks) >= 5:
                # Fallback 5-point model
                left_eye, right_eye, nose, left_mouth, right_mouth = landmarks[:5]
                mouth_width = abs(right_mouth[0] - left_mouth[0])
                eye_distance = abs(right_eye[0] - left_eye[0])

                # Estimate mouth openness from nose-to-mouth distance
                nose_to_mouth = abs(left_mouth[1] - nose[1])
                expr.mouth_open = min(1.0, nose_to_mouth / (eye_distance * 0.5 + 1e-6))

                # Estimate eye openness (simplified)
                expr.eye_open_left = 0.8
                expr.eye_open_right = 0.8

            # Calculate gaze direction (simplified)
            if len(landmarks) >= 5:
                left_eye = landmarks[0]
                right_eye = landmarks[1]
                nose = landmarks[2]
                eye_center_x = (left_eye[0] + right_eye[0]) / 2
                gaze_x = (nose[0] - eye_center_x) / (abs(right_eye[0] - left_eye[0]) + 1e-6)
                expr.gaze = (float(np.clip(gaze_x, -1.0, 1.0)), 0.0)

        except Exception:
            pass

        return expr

    def _detect_hands(self, frame: npt.NDArray[np.uint8]) -> List[HandLandmarks]:
        """Detect hands using MediaPipe."""
        hands = []

        if self._hand_detector is None:
            return hands

        try:
            results = self._hand_detector.process(frame)
            if results.multi_hand_landmarks and results.multi_handedness:
                for hand_landmarks, handedness in zip(
                    results.multi_hand_landmarks, results.multi_handedness
                ):
                    hand = HandLandmarks()
                    hand.landmarks = np.array([
                        [lm.x, lm.y, lm.z] for lm in hand_landmarks.landmark
                    ])
                    hand.handedness = handedness.classification[0].label
                    hand.confidence = handedness.classification[0].score
                    hand.gesture = self._classify_gesture(hand.landmarks)
                    hands.append(hand)
        except Exception:
            pass

        return hands

    def _classify_gesture(self, landmarks: npt.NDArray) -> str:
        """Classify hand gesture from landmarks."""
        if len(landmarks) < 21:
            return "unknown"

        # Finger tip indices: thumb=4, index=8, middle=12, ring=16, pinky=20
        # Finger mcp indices: thumb=2, index=5, middle=9, ring=13, pinky=17

        thumb_tip = landmarks[4]
        index_tip = landmarks[8]
        middle_tip = landmarks[12]
        ring_tip = landmarks[16]
        pinky_tip = landmarks[20]

        index_mcp = landmarks[5]
        middle_mcp = landmarks[9]
        ring_mcp = landmarks[13]
        pinky_mcp = landmarks[17]

        # Check if fingers are extended
        index_extended = index_tip[1] < index_mcp[1] - 0.05
        middle_extended = middle_tip[1] < middle_mcp[1] - 0.05
        ring_extended = ring_tip[1] < ring_mcp[1] - 0.05
        pinky_extended = pinky_tip[1] < pinky_mcp[1] - 0.05

        # Thumb (simplified - check if tip is far from palm)
        palm_center = np.mean(landmarks[0:5], axis=0)
        thumb_extended = np.linalg.norm(thumb_tip - palm_center) > 0.15

        # Classify gestures
        if index_extended and middle_extended and not ring_extended and not pinky_extended:
            return "peace"
        elif index_extended and not middle_extended and not ring_extended and not pinky_extended:
            return "pointing"
        elif not index_extended and not middle_extended and not ring_extended and not pinky_extended:
            return "fist"
        elif index_extended and middle_extended and ring_extended and pinky_extended:
            return "open_hand"
        elif thumb_extended and not index_extended:
            return "thumbs_up"
        else:
            return "other"

    def _smooth_head_pose(
        self,
        current: HeadPose,
        previous: HeadPose,
    ) -> HeadPose:
        """Apply temporal smoothing to head pose using Kalman filter or EMA."""
        if self._kalman_initialized and self._kf_head_pose is not None:
            try:
                z = np.array([
                    current.pitch, current.yaw, current.roll,
                    current.position[0], current.position[1],
                ], dtype=np.float64)
                self._kf_head_pose.predict()
                self._kf_head_pose.update(z)
                x = self._kf_head_pose.x.flatten()
                return HeadPose(
                    pitch=float(x[0]),
                    yaw=float(x[1]),
                    roll=float(x[2]),
                    position=(float(x[3]), float(x[4])),
                    confidence=current.confidence,
                )
            except Exception:
                pass

        # Fallback to EMA
        alpha = self._smoothing_factor
        smoothed = HeadPose(
            pitch=current.pitch * alpha + previous.pitch * (1 - alpha),
            yaw=current.yaw * alpha + previous.yaw * (1 - alpha),
            roll=current.roll * alpha + previous.roll * (1 - alpha),
            position=(
                current.position[0] * alpha + previous.position[0] * (1 - alpha),
                current.position[1] * alpha + previous.position[1] * (1 - alpha),
            ),
            confidence=current.confidence,
        )
        return smoothed

    def _smooth_expression(
        self,
        current: FacialExpression,
        previous: FacialExpression,
    ) -> FacialExpression:
        """Apply temporal smoothing to expression using Kalman filter or EMA."""
        if self._kalman_initialized and self._kf_expression is not None:
            try:
                z = np.array([
                    current.mouth_open, current.mouth_smile, current.eyebrow_raise,
                    current.eye_open_left, current.eye_open_right,
                ], dtype=np.float64)
                self._kf_expression.predict()
                self._kf_expression.update(z)
                x = self._kf_expression.x.flatten()
                return FacialExpression(
                    mouth_open=float(x[0]),
                    mouth_smile=float(x[1]),
                    eyebrow_raise=float(x[2]),
                    eye_open_left=float(x[3]),
                    eye_open_right=float(x[4]),
                    gaze=current.gaze,
                )
            except Exception:
                pass

        # Fallback to EMA
        alpha = self._smoothing_factor
        return FacialExpression(
            mouth_open=current.mouth_open * alpha + previous.mouth_open * (1 - alpha),
            mouth_smile=current.mouth_smile * alpha + previous.mouth_smile * (1 - alpha),
            eyebrow_raise=current.eyebrow_raise * alpha + previous.eyebrow_raise * (1 - alpha),
            eye_open_left=current.eye_open_left * alpha + previous.eye_open_left * (1 - alpha),
            eye_open_right=current.eye_open_right * alpha + previous.eye_open_right * (1 - alpha),
            gaze=(
                current.gaze[0] * alpha + previous.gaze[0] * (1 - alpha),
                current.gaze[1] * alpha + previous.gaze[1] * (1 - alpha),
            ),
        )

    def apply_expression_transfer(
        self,
        target_frame: npt.NDArray[np.uint8],
        source_expression: FacialExpression,
        target_expression: FacialExpression,
        intensity: float = 1.0,
    ) -> npt.NDArray[np.uint8]:
        """
        Transfer expression from source to target frame.
        Used for lip sync and expression mirroring.
        """
        try:
            import cv2
            h, w = target_frame.shape[:2]
            result = target_frame.copy()

            # Calculate expression difference
            mouth_diff = source_expression.mouth_open - target_expression.mouth_open
            smile_diff = source_expression.mouth_smile - target_expression.mouth_smile

            # Apply mouth deformation
            if abs(mouth_diff) > 0.05:
                mouth_center = (int(w * 0.5), int(h * 0.65))
                mouth_w = int(w * 0.12)
                mouth_h = int(h * 0.03)

                # Stretch/compress mouth vertically
                stretch = int(mouth_h * mouth_diff * intensity * 2)
                if abs(stretch) > 1:
                    src_tri = np.float32([
                        [mouth_center[0] - mouth_w, mouth_center[1] - mouth_h],
                        [mouth_center[0] + mouth_w, mouth_center[1] - mouth_h],
                        [mouth_center[0], mouth_center[1] + mouth_h],
                    ])
                    dst_tri = np.float32([
                        [mouth_center[0] - mouth_w, mouth_center[1] - mouth_h - stretch],
                        [mouth_center[0] + mouth_w, mouth_center[1] - mouth_h - stretch],
                        [mouth_center[0], mouth_center[1] + mouth_h + stretch],
                    ])
                    warp_mat = cv2.getAffineTransform(src_tri, dst_tri)
                    result = cv2.warpAffine(result, warp_mat, (w, h))

            # Apply smile warp
            if abs(smile_diff) > 0.05:
                mouth_center = (int(w * 0.5), int(h * 0.65))
                mouth_w = int(w * 0.15)
                smile_amount = smile_diff * intensity * 5

                # Pull mouth corners outward for smile
                left_shift = int(smile_amount)
                if abs(left_shift) > 0:
                    left_corner = (int(w * 0.35), int(h * 0.65))
                    right_corner = (int(w * 0.65), int(h * 0.65))

                    src_pts = np.float32([
                        [left_corner[0], left_corner[1]],
                        [right_corner[0], right_corner[1]],
                        [mouth_center[0], mouth_center[1]],
                    ])
                    dst_pts = np.float32([
                        [left_corner[0] - left_shift, left_corner[1] - left_shift // 2],
                        [right_corner[0] + left_shift, right_corner[1] - left_shift // 2],
                        [mouth_center[0], mouth_center[1] + abs(left_shift) // 2],
                    ])

                    warp_mat = cv2.getAffineTransform(src_pts, dst_pts)
                    result = cv2.warpAffine(result, warp_mat, (w, h))

            return result
        except Exception:
            return target_frame

    def apply_head_pose_transfer(
        self,
        target_frame: npt.NDArray[np.uint8],
        source_pose: HeadPose,
        target_pose: HeadPose,
        intensity: float = 1.0,
    ) -> npt.NDArray[np.uint8]:
        """
        Transfer head pose from source to target.
        Applies rotation and slight translation to match source head position.
        """
        try:
            import cv2
            h, w = target_frame.shape[:2]
            center = (w // 2, h // 2)

            # Calculate pose difference
            yaw_diff = (source_pose.yaw - target_pose.yaw) * intensity
            pitch_diff = (source_pose.pitch - target_pose.pitch) * intensity
            roll_diff = (source_pose.roll - target_pose.roll) * intensity

            # Apply rotation (yaw = horizontal, roll = tilt)
            M = cv2.getRotationMatrix2D(center, roll_diff, 1.0)

            # Add translation based on yaw
            tx = np.tan(np.radians(yaw_diff)) * w * 0.3
            ty = np.tan(np.radians(pitch_diff)) * h * 0.3
            M[0, 2] += tx
            M[1, 2] += ty

            result = cv2.warpAffine(target_frame, M, (w, h), borderMode=cv2.BORDER_REFLECT)
            return result
        except Exception:
            return target_frame

    @property
    def available(self) -> bool:
        return self._loaded

    @property
    def hand_tracking_available(self) -> bool:
        return self._hand_detector is not None

    def unload(self) -> None:
        """Release all resources."""
        if self._hand_detector is not None:
            self._hand_detector.close()
            self._hand_detector = None
        self._face_detector = None
        self._kf_head_pose = None
        self._kf_expression = None
        self._kalman_initialized = False
        self._loaded = False
