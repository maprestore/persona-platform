
"""Real-time webcam face-swap demo with virtual camera output."""

import cv2
import numpy as np
from shared.types import VideoFrame
from persona_swap_core import PersonaSwapCore
from persona_swap_core.virtual_cam import VirtualCamera


def main() -> None:
    import argparse
    parser = argparse.ArgumentParser(description="Real-time face swap demo")
    parser.add_argument("--source", required=True, help="Path to source face image")
    parser.add_argument("--device", default="cuda", help="Device: cuda or cpu")
    parser.add_argument("--virtual-cam", action="store_true", help="Output to virtual camera")
    parser.add_argument("--cam-id", type=int, default=0, help="Webcam device ID")
    args = parser.parse_args()

    source_img = cv2.imread(args.source)
    if source_img is None:
        print(f"Failed to load source image: {args.source}")
        return

    engine = PersonaSwapCore()
    engine.load(device=args.device)
    engine.set_source(source_img)

    cam = VirtualCamera() if args.virtual_cam else None
    if cam:
        cam.start()

    cap = cv2.VideoCapture(args.cam_id)
    if not cap.isOpened():
        print("Failed to open webcam")
        engine.unload()
        return

    print("Press Q to quit")
    while True:
        ret, frame = cap.read()
        if not ret:
            break

        vf = VideoFrame(image=frame)
        result = engine.swap(vf, vf)

        if cam:
            cam.send(result)
        else:
            cv2.imshow("Persona Swap", result.image)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()
    if cam:
        cam.stop()
    engine.unload()


if __name__ == "__main__":
    main()