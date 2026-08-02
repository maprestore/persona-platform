
"""Batch face-swap a video file."""

import cv2
import numpy as np
from shared.types import VideoFrame
from persona_swap_core import PersonaSwapCore


def main() -> None:
    import argparse
    parser = argparse.ArgumentParser(description="Batch video face swap")
    parser.add_argument("--source", required=True, help="Source face image")
    parser.add_argument("--input", required=True, help="Input video file")
    parser.add_argument("--output", required=True, help="Output video file")
    parser.add_argument("--device", default="cuda")
    args = parser.parse_args()

    source_img = cv2.imread(args.source)
    engine = PersonaSwapCore()
    engine.load(device=args.device)
    engine.set_source(source_img)

    cap = cv2.VideoCapture(args.input)
    fps = int(cap.get(cv2.CAP_PROP_FPS))
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    out = cv2.VideoWriter(args.output, cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h))

    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    frame_idx = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        vf = VideoFrame(image=frame)
        result = engine.swap(vf, vf)
        out.write(result.image)
        frame_idx += 1
        if frame_idx % 100 == 0:
            print(f"Processed {frame_idx}/{total}")

    cap.release()
    out.release()
    engine.unload()
    print(f"Done: {args.output}")


if __name__ == "__main__":
    main()