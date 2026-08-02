
"""Minimal face-swap example."""

import cv2
from shared.types import VideoFrame
from persona_swap_core import PersonaSwapCore


def main() -> None:
    engine = PersonaSwapCore()
    engine.load(device="cuda")

    cap = cv2.VideoCapture(0)
    source = cv2.imread("source_face.jpg")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        source_frame = VideoFrame(image=source)
        target_frame = VideoFrame(image=frame)
        result = engine.swap(source_frame, target_frame)
        cv2.imshow("Persona Swap", result.image)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()
    engine.unload()


if __name__ == "__main__":
    main()