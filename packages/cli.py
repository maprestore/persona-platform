"""Persona Platform CLI."""

import argparse
import sys


def main() -> None:
    parser = argparse.ArgumentParser(prog="persona", description="Persona Platform CLI")
    sub = parser.add_subparsers(dest="command")

    swap = sub.add_parser("swap", help="Run face/voice swap")
    swap.add_argument("--face-source", required=True)
    swap.add_argument("--voice-source", default=None)
    swap.add_argument("--device", default="cuda")

    serve = sub.add_parser("serve", help="Start API server")
    serve.add_argument("--port", type=int, default=6967)
    serve.add_argument("--host", default="0.0.0.0")

    pipeline = sub.add_parser("pipeline", help="Run a pipeline")
    pipeline.add_argument("run")
    pipeline.add_argument("config_path")

    args = parser.parse_args()

    if args.command == "swap":
        print(f"[persona] swap mode — face_source={args.face_source}, device={args.device}")
    elif args.command == "serve":
        from sdk.server import create_app
        import uvicorn
        app = create_app()
        print(f"[persona] API server starting on {args.host}:{args.port}")
        uvicorn.run(app, host=args.host, port=args.port)
    elif args.command == "pipeline":
        print(f"[persona] pipeline mode — config={args.config_path}")
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()