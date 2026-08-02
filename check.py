import sys
print(f"Python: {sys.version}")
print()

# Check insightface
try:
    from insightface.app import FaceAnalysis
    print("[OK] insightface imported")
except Exception as e:
    print(f"[FAIL] insightface: {e}")

# Check onnxruntime
try:
    import onnxruntime
    print(f"[OK] onnxruntime {onnxruntime.__version__}")
except Exception as e:
    print(f"[FAIL] onnxruntime: {e}")

# Check opencv
try:
    import cv2
    print(f"[OK] opencv {cv2.__version__}")
except Exception as e:
    print(f"[FAIL] opencv: {e}")

# Check models
import os
home = os.path.expanduser("~")
buffalo = os.path.join(home, ".insightface", "models", "buffalo_1")
swapper = os.path.join(home, ".insightface", "models", "inswapper_128.onnx")
print(f"[{'OK' if os.path.isdir(buffalo) else 'FAIL'}] buffalo_1 model: {buffalo}")
print(f"[{'OK' if os.path.isfile(swapper) else 'FAIL'}] inswapper_128.onnx: {swapper}")

# Try loading
try:
    from insightface.app import FaceAnalysis
    app = FaceAnalysis(name="buffalo_1", providers=["CPUExecutionProvider"])
    app.prepare(ctx_id=-1)
    print("[OK] FaceAnalysis loaded")
except Exception as e:
    print(f"[FAIL] FaceAnalysis load: {e}")
