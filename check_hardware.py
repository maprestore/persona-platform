"""
Persona Platform - Hardware Compatibility Checker
Run this to see if your laptop can handle it.
"""

import os
import sys
import platform
import subprocess
import shutil

def check_python():
    v = sys.version_info
    ok = v >= (3, 10)
    return {
        "name": "Python",
        "value": f"{v.major}.{v.minor}.{v.micro}",
        "ok": ok,
        "need": "3.10+",
    }

def check_ram():
    try:
        with open("/proc/meminfo") as f:
            for line in f:
                if "MemTotal" in line:
                    kb = int(line.split()[1])
                    gb = kb / 1048576
                    return {"name": "RAM", "value": f"{gb:.1f} GB", "ok": gb >= 4, "need": "4 GB min, 8 GB recommended"}
    except FileNotFoundError:
        pass
    # Windows
    try:
        import ctypes
        kernel32 = ctypes.windll.kernel32
        c_ulonglong = ctypes.c_ulonglong
        class MEMORYSTATUSEX(ctypes.Structure):
            _fields_ = [
                ("dwLength", ctypes.c_ulong),
                ("dwMemoryLoad", ctypes.c_ulong),
                ("ullTotalPhys", c_ulonglong),
                ("ullAvailPhys", c_ulonglong),
                ("ullTotalPageFile", c_ulonglong),
                ("ullAvailPageFile", c_ulonglong),
                ("ullTotalVirtual", c_ulonglong),
                ("ullAvailVirtual", c_ulonglong),
                ("ullAvailExtendedVirtual", c_ulonglong),
            ]
        mem = MEMORYSTATUSEX()
        mem.dwLength = ctypes.sizeof(mem)
        kernel32.GlobalMemoryStatusEx(ctypes.byref(mem))
        gb = mem.ullTotalPhys / (1024**3)
        return {"name": "RAM", "value": f"{gb:.1f} GB", "ok": gb >= 4, "need": "4 GB min, 8 GB recommended"}
    except Exception:
        return {"name": "RAM", "value": "unknown", "ok": False, "need": "4 GB min, 8 GB recommended"}

def check_cpu():
    name = platform.processor() or platform.machine()
    cores = os.cpu_count() or 0
    return {
        "name": "CPU",
        "value": f"{name} ({cores} cores)",
        "ok": cores >= 2,
        "need": "2+ cores",
    }

def check_nvidia_gpu():
    try:
        out = subprocess.check_output(
            ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
            stderr=subprocess.DEVNULL, text=True
        ).strip()
        if out:
            parts = out.split(", ")
            gpu_name = parts[0].strip()
            vram = parts[1].strip() if len(parts) > 1 else "?"
            return {
                "name": "NVIDIA GPU",
                "value": f"{gpu_name} ({vram} MB VRAM)",
                "ok": True,
                "need": "Any NVIDIA GPU (GTX 1050+ recommended)",
                "cuda": True,
            }
    except (FileNotFoundError, subprocess.CalledProcessError):
        pass
    return {
        "name": "NVIDIA GPU",
        "value": "Not found",
        "ok": False,
        "need": "Any NVIDIA GPU (GTX 1050+ recommended)",
        "cuda": False,
    }

def check_opencv():
    try:
        import cv2
        return {"name": "OpenCV", "value": cv2.__version__, "ok": True, "need": "4.8+"}
    except ImportError:
        return {"name": "OpenCV", "value": "Not installed", "ok": False, "need": "4.8+"}

def check_torch():
    try:
        import torch
        cuda = torch.cuda.is_available()
        return {
            "name": "PyTorch",
            "value": f"{torch.__version__} (CUDA: {'Yes' if cuda else 'No'})",
            "ok": True,
            "need": "2.0+",
            "cuda": cuda,
        }
    except ImportError:
        return {"name": "PyTorch", "value": "Not installed", "ok": False, "need": "2.0+"}

def check_fastapi():
    try:
        import fastapi
        return {"name": "FastAPI", "value": fastapi.__version__, "ok": True, "need": "0.100+"}
    except ImportError:
        return {"name": "FastAPI", "value": "Not installed", "ok": False, "need": "0.100+"}

def check_insightface():
    try:
        import insightface
        return {"name": "InsightFace", "value": "Installed", "ok": True, "need": "0.7+ (for face swap)"}
    except ImportError:
        return {"name": "InsightFace", "value": "Not installed", "ok": False, "need": "0.7+ (for face swap)"}

def check_disk():
    total, used, free = shutil.disk_usage("/")
    free_gb = free / (1024**3)
    return {"name": "Disk Free", "value": f"{free_gb:.1f} GB", "ok": free_gb >= 5, "need": "5+ GB free"}

def check_camera():
    if sys.platform == "linux":
        for i in range(10):
            dev = f"/dev/video{i}"
            if os.path.exists(dev):
                return {"name": "Camera", "value": f"Found at {dev}", "ok": True, "need": "Any camera (USB or built-in)"}
    return {"name": "Camera", "value": "Not detected (may still work via browser)", "ok": True, "need": "Any camera (USB or built-in)"}

def estimate_fps(has_cuda, ram_gb, cores):
    if has_cuda:
        return "30+ FPS (GPU accelerated)"
    if ram_gb >= 8 and cores >= 4:
        return "10-20 FPS (CPU mode)"
    if ram_gb >= 4 and cores >= 2:
        return "3-8 FPS (CPU mode, basic quality)"
    return "1-3 FPS (too slow for real-time)"

def main():
    print("=" * 50)
    print("   Persona Platform - Hardware Check")
    print("=" * 50)
    print()

    checks = [
        check_python(),
        check_ram(),
        check_cpu(),
        check_nvidia_gpu(),
        check_opencv(),
        check_torch(),
        check_fastapi(),
        check_insightface(),
        check_disk(),
        check_camera(),
    ]

    passed = 0
    failed = 0
    has_cuda = False
    ram_gb = 4
    cores = 2

    for c in checks:
        status = "[OK]" if c["ok"] else "[!!]"
        print(f"  {status} {c['name']:15s} {c['value']}")
        if not c["ok"]:
            print(f"       Need: {c['need']}")
            failed += 1
        else:
            passed += 1
        if c.get("cuda"):
            has_cuda = True
        if "RAM" in c["name"]:
            try:
                ram_gb = float(c["value"].split()[0])
            except ValueError:
                pass
        if "CPU" in c["name"]:
            try:
                cores = int(c["value"].split("(")[1].split()[0])
            except (ValueError, IndexError):
                pass

    print()
    print("-" * 50)
    print(f"  Results: {passed} passed, {failed} issues")
    print()

    # Estimate FPS
    fps_estimate = estimate_fps(has_cuda, ram_gb, cores)
    print(f"  Estimated performance: {fps_estimate}")
    print()

    # Verdict
    critical_missing = []
    for c in checks:
        if not c["ok"] and c["name"] in ("Python", "RAM"):
            critical_missing.append(c["name"])

    if critical_missing:
        print(f"  BLOCKED: Missing critical requirements: {', '.join(critical_missing)}")
        print("  Fix the above issues before running.")
    elif failed == 0:
        print("  READY: Your laptop can run persona-platform!")
    elif not has_cuda:
        print("  PARTIAL: Works on CPU but GPU is recommended for real-time.")
        print("  Face swap will be slow (3-15 FPS). Consider:")
        print("    - Add an NVIDIA GPU, or")
        print("    - Use a cloud GPU (Vast.ai ~$0.15/hr)")
    else:
        print("  MOSTLY READY: Some optional features missing.")
        print("  Core face swap will work.")

    print()
    print("=" * 50)

if __name__ == "__main__":
    main()
