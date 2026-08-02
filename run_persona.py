"""
Persona Studio - Cross-platform launcher
One command to install, set up, and run on Windows, macOS, Linux, or Termux.
"""

import os
import sys
import subprocess
import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parent
VENV_DIR = ROOT / ".venv"
PACKAGES_DIR = ROOT / "packages"

PLATFORM = "termux" if "TERMUX_VERSION" in os.environ else sys.platform


def add_src_to_path():
    src_dirs = [
        PACKAGES_DIR / "shared" / "src",
        PACKAGES_DIR / "persona-swap-core" / "src",
        PACKAGES_DIR / "sdk" / "src",
        PACKAGES_DIR / "magiclip" / "src",
    ]
    for d in src_dirs:
        if d.exists() and str(d) not in sys.path:
            sys.path.insert(0, str(d))


def run(cmd, **kwargs):
    print(f"[persona] Running: {' '.join(cmd)}")
    return subprocess.check_call(cmd, **kwargs)


def get_python():
    if VENV_DIR.exists():
        if sys.platform == "win32":
            py = str(VENV_DIR / "Scripts" / "python.exe")
        else:
            py = str(VENV_DIR / "bin" / "python")
        if Path(py).exists():
            return py
    return sys.executable


def ensure_venv():
    if not VENV_DIR.exists():
        print("[1/3] Creating virtual environment...")
        run([sys.executable, "-m", "venv", str(VENV_DIR)])
    else:
        print("[1/3] Virtual environment exists")


def install_deps():
    flag = VENV_DIR / "installed.flag"
    if flag.exists():
        print("[2/3] Dependencies already installed")
        return

    pip = [get_python(), "-m", "pip"]
    print("[2/3] Installing dependencies (one-time)...")
    run(pip + ["install", "--quiet", "--upgrade", "pip", "setuptools", "wheel"])

    packages = ["shared", "persona-swap-core", "sdk", "magiclip"]
    for pkg in packages:
        pkg_path = str(PACKAGES_DIR / pkg)
        run(pip + ["install", "--quiet", "-e", pkg_path])

    if PLATFORM != "termux":
        try:
            run(pip + ["install", "--quiet", "pyvirtualcam"])
        except Exception:
            print("[persona] pyvirtualcam not available (optional)")

    flag.write_text("installed")
    print("[2/3] Installation complete")


def get_local_ip():
    try:
        import socket
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def start_server(args):
    os.chdir(str(ROOT))
    add_src_to_path()

    import uvicorn
    from sdk.server import create_app, _engine_state

    host = args.host or "0.0.0.0"
    port = args.port or 6967

    if args.source:
        src_path = Path(args.source)
        if src_path.exists():
            import cv2
            img = cv2.imread(str(src_path))
            if img is not None:
                _engine_state.get_engine().set_source(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
                print(f"[persona] Source loaded: {src_path.name}")

    local_ip = get_local_ip()
    print(f"[persona] Server: http://{host}:{port}")
    print(f"[persona] Cam:    http://{local_ip}:{port}/cam")
    print(f"[persona] Phone:  http://{local_ip}:{port}/phone")
    print("[persona] Press Ctrl+C to stop")

    uvicorn.run(create_app(), host=host, port=port, log_level="info")


def main():
    parser = argparse.ArgumentParser(description="Persona Studio Launcher")
    parser.add_argument("--source", "--image", help="Source face photo path")
    parser.add_argument("--port", type=int, default=6967, help="Server port")
    parser.add_argument("--host", default="0.0.0.0", help="Bind address")
    parser.add_argument("--skip-install", action="store_true", help="Skip dependency install")
    args = parser.parse_args()

    print(f"========================================")
    print(f"   Persona Studio — {PLATFORM}")
    print(f"========================================")
    print()

    if not args.skip_install:
        ensure_venv()
        install_deps()

    start_server(args)


if __name__ == "__main__":
    main()
