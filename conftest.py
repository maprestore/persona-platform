from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PACKAGES_DIR = ROOT / "packages"

for pkg_dir in sorted(PACKAGES_DIR.iterdir()):
    if not pkg_dir.is_dir() or pkg_dir.name.startswith("__"):
        continue
    src = pkg_dir / "src"
    if src.is_dir():
        src_str = str(src)
        if src_str not in sys.path:
            sys.path.insert(0, src_str)
    if pkg_dir.name == "cli.py" or (pkg_dir / "cli.py").is_file():
        pkg_str = str(pkg_dir)
        if pkg_str not in sys.path:
            sys.path.insert(0, pkg_str)
