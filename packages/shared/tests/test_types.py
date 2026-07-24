from __future__ import annotations

from shared.types import VideoFrame, AudioFrame, DeviceType, FaceDetection, BodyPose


def test_video_frame_defaults() -> None:
    import numpy as np
    frame = VideoFrame(image=np.zeros((10, 10, 3), dtype=np.uint8))
    assert frame.timestamp == 0.0
    assert frame.faces == []
    assert frame.pose is None


def test_audio_frame() -> None:
    import numpy as np
    audio = AudioFrame(samples=np.zeros(16000, dtype=np.float32))
    assert audio.sample_rate == 16000


def test_device_type_values() -> None:
    assert DeviceType.CPU.value == "cpu"
    assert DeviceType.CUDA.value == "cuda"


def test_face_detection() -> None:
    det = FaceDetection(bbox=[0, 0, 100, 100], landmarks=[[50, 50]], confidence=0.95)
    assert det.confidence == 0.95