"""Persona Platform CLI - local face swap for video calls."""

from __future__ import annotations

import argparse
import sys
import time
import threading
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="persona",
        description="Persona Studio - Real-time face swap for video calls",
    )
    sub = parser.add_subparsers(dest="command")

    # serve - start API server
    serve = sub.add_parser("serve", help="Start API server")
    serve.add_argument("--port", type=int, default=6967)
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--source", type=str, default=None, help="Source image file")
    serve.add_argument("--device", default="cpu")

    # run - start everything for local use
    run = sub.add_parser("run", help="Start with source and output to virtual camera")
    run.add_argument("--port", type=int, default=6967)
    run.add_argument("--host", default="127.0.0.1")
    run.add_argument("--source", type=str, default=None, help="Source image or video file path")
    run.add_argument("--device", default="cpu")
    run.add_argument("--cam-name", default="Persona Camera")

    # cam - list/start/stop virtual cameras
    cam = sub.add_parser("cam", help="Virtual camera control")
    cam.add_argument("action", choices=["list", "start", "stop", "stream"])
    cam.add_argument("--source", type=str, default=None)
    cam.add_argument("--width", type=int, default=1280)
    cam.add_argument("--height", type=int, default=720)
    cam.add_argument("--fps", type=int, default=30)
    cam.add_argument("--device", default="cpu")

    # swap - quick face swap
    swap = sub.add_parser("swap", help="Quick face swap")
    swap.add_argument("source", type=str)
    swap.add_argument("target", type=str)
    swap.add_argument("--output", "-o", type=str, default=None)
    swap.add_argument("--device", default="cpu")

    args = parser.parse_args()

    if args.command == "serve":
        _cmd_serve(args)
    elif args.command == "run":
        _cmd_run(args)
    elif args.command == "cam":
        _cmd_cam(args)
    elif args.command == "swap":
        _cmd_swap(args)
    else:
        parser.print_help()
        sys.exit(1)


def _cmd_serve(args: argparse.Namespace) -> None:
    from sdk.server import create_app
    import uvicorn
    import cv2

    app = create_app()

    if args.source:
        source_path = Path(args.source)
        if source_path.exists():
            img_bgr = cv2.imread(str(source_path))
            if img_bgr is not None:
                from sdk.server import _engine_state
                engine = _engine_state.get_engine()
                engine.set_source(cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB))
                print(f"[persona] Loaded source: {args.source}")

    print(f"[persona] API server: http://{args.host}:{args.port}")
    print(f"[persona] Web UI:     http://{args.host}:{args.port}/ui/  (if frontend built)")
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


def _cmd_run(args: argparse.Namespace) -> None:
    import subprocess
    from sdk.server import create_app
    import uvicorn
    import cv2
    import numpy as np
    from persona_swap_core import PersonaSwapCore
    from persona_swap_core.virtual_cam import VirtualCamera, VirtualCameraManager
    from shared.types import VideoFrame

    engine = PersonaSwapCore()
    engine.load(device=args.device)

    source_path = Path(args.source) if args.source else None

    if source_path and source_path.exists():
        img_bgr = cv2.imread(str(source_path))
        if img_bgr is not None:
            engine.set_source(cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB))
            print(f"[persona] Loaded source: {source_path}")

    # Start virtual camera (try multiple backends)
    vcam = VirtualCamera(name=args.cam_name, width=1280, height=720, fps=30)
    started = vcam.start()
    if started:
        print(f"[persona] Virtual camera '{args.cam_name}' started")
    else:
        print("[persona] No virtual camera backend found")
        print("  On Linux: sudo modprobe v4l2loopback")
        print("  On Windows/Mac: pip install pyvirtualcam")

    # Start API server in background
    app = create_app()

    def _run_server():
        uvicorn.run(app, host=args.host, port=args.port, log_level="warning")

    server_thread = threading.Thread(target=_run_server, daemon=True)
    server_thread.start()

    # Start frontend dev server in background
    frontend_dir = Path(__file__).resolve().parent.parent / "no-code-pipeline" / "frontend"
    frontend_proc = None
    if frontend_dir.exists():
        try:
            frontend_proc = subprocess.Popen(
                ["npx", "vite", "--host", args.host, "--port", str(args.port + 1)],
                cwd=str(frontend_dir),
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            print(f"[persona] Frontend: http://{args.host}:{args.port + 1}")
        except FileNotFoundError:
            print("[persona] npm not found, frontend not available")

    # If source is a video, stream it to virtual camera
    if source_path and source_path.exists():
        ext = source_path.suffix.lower()
        if ext in (".mp4", ".avi", ".mov", ".mkv", ".webm"):
            threading.Thread(
                target=_stream_video_to_cam,
                args=(str(source_path), engine, vcam),
                daemon=True,
            ).start()

    api_url = f"http://{args.host}:{args.port}"
    frontend_url = f"http://{args.host}:{args.port + 1}"

    print(f"\n[persona] Running!")
    print(f"  Web UI:   {frontend_url}")
    print(f"  API:      {api_url}")
    print(f"  Camera:   {args.cam_name}")
    print(f"  Source:   {args.source or 'upload via web UI'}")
    print(f"\nTo use in video calls:")
    print(f"  1. Select '{args.cam_name}' as your camera in Zoom/Teams/Discord")
    print(f"  2. Upload face in the web UI")
    print(f"  3. Face swap will appear in your video call")
    print("\nPress Ctrl+C to stop")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[persona] Shutting down...")
    finally:
        vcam.stop()
        engine.unload()
        if frontend_proc:
            frontend_proc.terminate()


def _stream_video_to_cam(
    video_path: str,
    engine: PersonaSwapCore,
    vcam,
) -> None:
    import cv2
    import numpy as np
    from shared.types import VideoFrame

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"[persona] Cannot open video: {video_path}")
        return

    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0:
        fps = 30
    frame_time = 1.0 / fps

    print(f"[persona] Streaming video source: {video_path} @ {fps:.1f} fps")
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue

            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            target = VideoFrame(image=frame_rgb)
            result = engine.swap(target, target)

            vcam.send(result.image)
            time.sleep(frame_time)
    except KeyboardInterrupt:
        pass
    finally:
        cap.release()


def _cmd_cam(args: argparse.Namespace) -> None:
    if args.action == "list":
        from persona_swap_core.virtual_cam import VirtualCameraManager
        mgr = VirtualCameraManager()
        cameras = mgr.detect_cameras()
        print(f"Found {len(cameras)} camera device(s):")
        for c in cameras:
            print(f"  {c['device']:15s}  {c['name']:30s}  {c['type']}")
        return

    if args.action in ("start", "stream"):
        from persona_swap_core import PersonaSwapCore
        from persona_swap_core.virtual_cam import VirtualCamera, VirtualCameraManager
        from shared.types import VideoFrame
        import cv2
        import numpy as np

        engine = PersonaSwapCore()
        engine.load(device=args.device)

        vcam = VirtualCamera(width=args.width, height=args.height, fps=args.fps)
        ok = vcam.start()
        if not ok:
            print("[persona] Failed to start virtual camera")
            print("  On Linux: sudo modprobe v4l2loopback")
            print("  On Windows/Mac: pip install pyvirtualcam")
            return

        print(f"[persona] Virtual camera running ({args.width}x{args.height} @ {args.fps}fps)")

        if args.source:
            source_path = Path(args.source)
            if source_path.exists():
                img = cv2.imread(str(source_path))
                if img is not None:
                    engine.set_source(img)
                    print(f"[persona] Source: {args.source}")

                    if args.action == "stream":
                        ext = source_path.suffix.lower()
                        if ext in (".mp4", ".avi", ".mov", ".mkv", ".webm"):
                            _stream_video_to_cam(str(source_path), engine, vcam)
                            return

        print("[persona] Streaming to virtual camera (Ctrl+C to stop)")
        cap = cv2.VideoCapture(0)
        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    time.sleep(0.033)
                    continue
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                target = VideoFrame(image=frame_rgb)
                result = engine.swap(target, target)
                vcam.send(result.image)
        except KeyboardInterrupt:
            pass
        finally:
            cap.release()
            vcam.stop()
            engine.unload()

    elif args.action == "stop":
        print("[persona] Use API: POST /virtual-cam/stop")
        import httpx
        try:
            resp = httpx.post("http://localhost:6967/virtual-cam/stop")
            print(resp.json())
        except Exception as e:
            print(f"Error: {e}")


def _cmd_swap(args: argparse.Namespace) -> None:
    import cv2
    import numpy as np
    from persona_swap_core import PersonaSwapCore

    source_path = Path(args.source)
    target_path = Path(args.target)

    if not source_path.exists():
        print(f"Source not found: {source_path}")
        sys.exit(1)
    if not target_path.exists():
        print(f"Target not found: {target_path}")
        sys.exit(1)

    source_img = cv2.imread(str(source_path))
    target_img = cv2.imread(str(target_path))

    if source_img is None:
        print("Cannot read source image")
        sys.exit(1)
    if target_img is None:
        print("Cannot read target image")
        sys.exit(1)

    from shared.types import VideoFrame
    engine = PersonaSwapCore()
    engine.load(device=args.device)

    source_frame = VideoFrame(image=cv2.cvtColor(source_img, cv2.COLOR_BGR2RGB))
    target_frame = VideoFrame(image=cv2.cvtColor(target_img, cv2.COLOR_BGR2RGB))
    result_frame = engine.swap(source_frame, target_frame)

    output_path = args.output or "swap_output.png"
    cv2.imwrite(str(output_path), cv2.cvtColor(result_frame.image, cv2.COLOR_RGB2BGR))
    print(f"[persona] Saved: {output_path}")

    engine.unload()


if __name__ == "__main__":
    main()
