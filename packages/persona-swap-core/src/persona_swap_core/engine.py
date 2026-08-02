
from __future__ import annotations

import numpy as np
import numpy.typing as npt
from shared.types import SwapEngine, VideoFrame, AudioFrame, TuningParams, WatermarkConfig
from shared.errors import FeatureUnavailableError
from .engines import FaceSwapEngine, VoiceConvertEngine, VoiceClonerEngine, LivePortraitEngine, BackgroundRemover, EffectsPipeline, AdvancedTrackingEngine


class PersonaSwapCore(SwapEngine):
    def __init__(self) -> None:
        self._face = FaceSwapEngine()
        self._voice = VoiceConvertEngine()
        self._voice_cloner = VoiceClonerEngine()
        self._live_portrait = LivePortraitEngine()
        self._background = BackgroundRemover()
        self._effects = EffectsPipeline()
        self._tracker = AdvancedTrackingEngine()
        self._loaded = False
        self._source_image: npt.NDArray | None = None
        self._source_faces: list[dict] | None = None
        self._tuning: TuningParams | None = None
        self._use_watermark: bool = True
        self._use_4k: bool = False
        self._load_errors: dict[str, str] = {}
        self._tracking_enabled: bool = True
        self._expression_transfer_enabled: bool = True
        self._head_pose_transfer_enabled: bool = True
        self._hand_overlay_enabled: bool = True

    def load(self, device: str = "cuda") -> None:
        self._load_errors.clear()
        self._face.load(device, use_4k=self._use_4k)
        if self._face.load_error:
            self._load_errors["face_swap"] = self._face.load_error
        self._voice.load(device)
        if self._voice.load_error:
            self._load_errors["voice_convert"] = self._voice.load_error
        self._voice_cloner.load(device)
        if self._voice_cloner.load_error:
            self._load_errors["voice_clone"] = self._voice_cloner.load_error
        self._live_portrait.load(device)
        self._background.load(device)
        self._tracker.load(device)
        self._loaded = True

    def status(self) -> dict[str, object]:
        return {
            "loaded": self._loaded,
            "features": {
                "face_swap": {"available": self._face.available, "error": self._face.load_error},
                "voice_convert": {"available": self._voice.available, "error": self._voice.load_error},
                "voice_clone": {"available": self._voice_cloner.available, "error": self._voice_cloner.load_error},
                "live_portrait": {"available": True, "error": None},
                "background": {"available": True, "error": None},
                "filters": {"available": True, "error": None},
                "advanced_tracking": {"available": self._tracker.available, "error": None},
                "hand_tracking": {"available": self._tracker.hand_tracking_available, "error": None},
            },
            "load_errors": dict(self._load_errors),
            "tracking": {
                "enabled": self._tracking_enabled,
                "expression_transfer": self._expression_transfer_enabled,
                "head_pose_transfer": self._head_pose_transfer_enabled,
                "hand_overlay": self._hand_overlay_enabled,
            },
        }

    def require_feature(self, feature: str) -> None:
        feature_info = self.status()["features"].get(feature, {})
        if not isinstance(feature_info, dict) or not feature_info.get("available", False):
            reason = str(feature_info.get("error") or "required model or dependency is not installed") if isinstance(feature_info, dict) else "unknown feature"
            raise FeatureUnavailableError(feature, reason)

    def set_source(self, image: npt.NDArray[np.uint8]) -> bool:
        faces = self._face.detect(image)
        if faces:
            self._source_image = image
            self._source_faces = faces
            return True
        self._source_image = image
        self._source_faces = None
        return False

    def has_source(self) -> bool:
        return self._source_faces is not None

    def set_tuning(self, tuning: TuningParams) -> None:
        self._tuning = tuning

    def set_watermark(self, enabled: bool) -> None:
        self._use_watermark = enabled

    def set_4k_mode(self, enabled: bool) -> None:
        self._use_4k = enabled
        if self._loaded:
            self._face.load(device=self._face.device, use_4k=enabled)

    def set_tracking(self, enabled: bool) -> None:
        """Enable/disable advanced tracking."""
        self._tracking_enabled = enabled

    def set_expression_transfer(self, enabled: bool) -> None:
        """Enable/disable expression transfer."""
        self._expression_transfer_enabled = enabled

    def set_head_pose_transfer(self, enabled: bool) -> None:
        """Enable/disable head pose transfer."""
        self._head_pose_transfer_enabled = enabled

    def set_hand_overlay(self, enabled: bool) -> None:
        """Enable/disable hand overlay."""
        self._hand_overlay_enabled = enabled

    def process_frame_with_tracking(
        self,
        target_frame: npt.NDArray[np.uint8],
    ) -> dict:
        """
        Process a frame with advanced tracking.
        Returns the processed frame and tracking data.
        """
        if not self._loaded or not self._tracking_enabled:
            return {"frame": target_frame, "tracking": None}

        # Get tracking state
        tracking_state = self._tracker.process_frame(target_frame)

        result_frame = target_frame.copy()

        # Compute source tracking state once for both expression and head pose transfer
        source_state = None
        if (self._expression_transfer_enabled or self._head_pose_transfer_enabled) and self._source_image is not None:
            source_state = self._tracker.process_frame(self._source_image)

        # Apply expression transfer if enabled
        if self._expression_transfer_enabled and source_state is not None:
            result_frame = self._tracker.apply_expression_transfer(
                result_frame,
                source_state.expression,
                tracking_state.expression,
                intensity=0.8,
            )

        # Apply head pose transfer if enabled
        if self._head_pose_transfer_enabled and source_state is not None:
            result_frame = self._tracker.apply_head_pose_transfer(
                result_frame,
                source_state.head_pose,
                tracking_state.head_pose,
                intensity=0.6,
            )

        # Draw hand overlay if enabled
        if self._hand_overlay_enabled:
            result_frame = self._draw_hand_overlay(result_frame, tracking_state)

        return {
            "frame": result_frame,
            "tracking": {
                "head_pose": {
                    "pitch": tracking_state.head_pose.pitch,
                    "yaw": tracking_state.head_pose.yaw,
                    "roll": tracking_state.head_pose.roll,
                    "confidence": tracking_state.head_pose.confidence,
                },
                "expression": {
                    "mouth_open": tracking_state.expression.mouth_open,
                    "mouth_smile": tracking_state.expression.mouth_smile,
                    "eye_open_left": tracking_state.expression.eye_open_left,
                    "eye_open_right": tracking_state.expression.eye_open_right,
                },
                "left_hand": {
                    "detected": tracking_state.left_hand is not None,
                    "gesture": tracking_state.left_hand.gesture if tracking_state.left_hand else None,
                },
                "right_hand": {
                    "detected": tracking_state.right_hand is not None,
                    "gesture": tracking_state.right_hand.gesture if tracking_state.right_hand else None,
                },
            },
        }

    def _draw_hand_overlay(
        self,
        frame: npt.NDArray[np.uint8],
        tracking_state,
    ) -> npt.NDArray[np.uint8]:
        """Draw hand landmarks overlay on frame."""
        try:
            import cv2
            result = frame.copy()
            h, w = frame.shape[:2]

            for hand in [tracking_state.left_hand, tracking_state.right_hand]:
                if hand is None:
                    continue

                landmarks = hand.landmarks
                color = (0, 255, 0) if hand.handedness == "Right" else (255, 0, 0)

                # Draw connections
                connections = [
                    (0, 1), (1, 2), (2, 3), (3, 4),  # Thumb
                    (0, 5), (5, 6), (6, 7), (7, 8),  # Index
                    (0, 9), (9, 10), (10, 11), (11, 12),  # Middle
                    (0, 13), (13, 14), (14, 15), (15, 16),  # Ring
                    (0, 17), (17, 18), (18, 19), (19, 20),  # Pinky
                    (5, 9), (9, 13), (13, 17),  # Palm
                ]

                for i, j in connections:
                    pt1 = (int(landmarks[i][0] * w), int(landmarks[i][1] * h))
                    pt2 = (int(landmarks[j][0] * w), int(landmarks[j][1] * h))
                    cv2.line(result, pt1, pt2, color, 2)

                # Draw landmarks
                for i, lm in enumerate(landmarks):
                    pt = (int(lm[0] * w), int(lm[1] * h))
                    cv2.circle(result, pt, 4, color, -1)

            return result
        except Exception:
            return frame

    def swap(self, source: VideoFrame, target: VideoFrame) -> VideoFrame:
        if not self._loaded:
            return target
        if self._source_faces is not None:
            swapped = self._face.swap(self._source_image, target.image, source_faces=self._source_faces, tuning=self._tuning)
        else:
            swapped = self._face.swap(source.image, target.image, tuning=self._tuning)

        if self._use_watermark:
            from .watermark import add_watermark
            swapped = add_watermark(swapped)

        target.image = swapped
        return target

    def swap_with_options(
        self,
        source: VideoFrame,
        target: VideoFrame,
        tuning: TuningParams | None = None,
        use_4k: bool = False,
        no_watermark: bool = False,
    ) -> VideoFrame:
        if not self._loaded:
            return target
        
        original_4k = self._use_4k
        if use_4k != self._use_4k:
            self._face.load(self._face.device, use_4k=use_4k)
        
        try:
            if self._source_faces is not None:
                swapped = self._face.swap(self._source_image, target.image, source_faces=self._source_faces, tuning=tuning or self._tuning)
            else:
                swapped = self._face.swap(source.image, target.image, tuning=tuning or self._tuning)

            if not no_watermark and self._use_watermark:
                from .watermark import add_watermark
                swapped = add_watermark(swapped)

            target.image = swapped
            return target
        finally:
            if use_4k != original_4k:
                self._face.load(self._face.device, use_4k=original_4k)

    def swap_batch(
        self,
        source: VideoFrame,
        targets: list[VideoFrame],
    ) -> list[VideoFrame]:
        if not self._loaded:
            return targets
        if self._source_faces is not None:
            source_img = self._source_image
            src_faces = self._source_faces
        else:
            source_img = source.image
            src_faces = self._face.detect(source_img)
        results = []
        for target in targets:
            swapped = self._face.swap(source_img, target.image, src_faces, tuning=self._tuning)
            if self._use_watermark:
                from .watermark import add_watermark
                swapped = add_watermark(swapped)
            target.image = swapped
            results.append(target)
        return results

    def swap_with_background(
        self,
        source: VideoFrame,
        target: VideoFrame,
        background: npt.NDArray[np.uint8] | None = None,
        bg_color: tuple[int, int, int] | None = None,
    ) -> VideoFrame:
        swapped = self.swap(source, target)
        swapped.image = self._background.replace_background(
            swapped.image, background=background, color=bg_color
        )
        return swapped

    def apply_filter(self, frame: VideoFrame, filter_name: str, intensity: float = 1.0) -> VideoFrame:
        frame.image = self._effects.apply_filter(frame.image, filter_name, intensity)
        return frame

    def animate_portrait(
        self,
        source_image: npt.NDArray[np.uint8],
        expression: str = "smile",
        intensity: float = 1.0,
        driving_video: list[npt.NDArray[np.uint8]] | None = None,
    ) -> list[npt.NDArray[np.uint8]]:
        return self._live_portrait.animate(source_image, driving_video, expression, intensity)

    def remove_background(
        self,
        image: npt.NDArray[np.uint8],
        method: str = "auto",
    ) -> tuple[npt.NDArray[np.uint8], npt.NDArray[np.uint8]]:
        return self._background.remove_background(image, method)

    def replace_background(
        self,
        image: npt.NDArray[np.uint8],
        background: npt.NDArray[np.uint8] | None = None,
        color: tuple[int, int, int] | None = None,
        method: str = "auto",
        blur_amount: int = 0,
    ) -> npt.NDArray[np.uint8]:
        return self._background.replace_background(image, background, color, method, blur_amount)

    def blur_background(
        self,
        image: npt.NDArray[np.uint8],
        kernel_size: int = 31,
        method: str = "auto",
    ) -> npt.NDArray[np.uint8]:
        return self._background.blur_background(image, kernel_size, method)

    def convert_voice(self, audio: AudioFrame, target_voice: str | None = None) -> AudioFrame:
        converted = self._voice.convert(audio.samples, audio.sample_rate, target_voice)
        audio.samples = converted
        return audio

    def clone_voice(
        self,
        audio: AudioFrame,
        target_voice: str,
        pitch_shift: float = 0.0,
        formant_shift: float = 0.0,
    ) -> AudioFrame:
        converted = self._voice_cloner.convert(
            audio.samples, audio.sample_rate, target_voice,
            pitch_shift=pitch_shift, formant_shift=formant_shift,
        )
        audio.samples = converted
        return audio

    def add_voice_sample(
        self, name: str, audio: npt.NDArray[np.float32], sample_rate: int = 16000
    ) -> None:
        self._voice_cloner.add_voice_sample(name, audio, sample_rate)

    def list_voices(self) -> list[str]:
        return self._voice_cloner.list_voices()

    def transcribe(self, audio: AudioFrame) -> str:
        return self._voice.transcribe(audio.samples, audio.sample_rate)

    def list_filters(self) -> list[str]:
        return self._effects.list_filters()

    def unload(self) -> None:
        self._face.unload()
        self._voice.unload()
        self._voice_cloner.unload()
        self._live_portrait.unload()
        self._background.unload()
        self._effects.unload()
        self._tracker.unload()
        self._loaded = False
        self._load_errors.clear()
