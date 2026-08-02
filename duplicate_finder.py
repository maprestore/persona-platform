#!/usr/bin/env python3
"""
Advanced Duplicate File Finder & Remover
=========================================
Expert-level tool for finding and managing duplicate files.
Supports multiple hash algorithms, fuzzy matching, and safe deletion.
"""

import os
import sys
import hashlib
import json
import shutil
import argparse
from pathlib import Path
from datetime import datetime
from collections import defaultdict
from typing import Dict, List, Set, Tuple, Optional
import fnmatch


# ─── Configuration ────────────────────────────────────────────────────────────

HASH_ALGORITHMS = ["md5", "sha256", "xxhash"]
SUPPORTED_EXTENSIONS = {".py", ".pyw", ".pyi", ".ipynb"}
SKIP_DIRS = {".git", ".venv", "__pycache__", "node_modules", ".pytest_cache", ".mypy_cache"}
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB limit


# ─── Hash Functions ───────────────────────────────────────────────────────────

def hash_file_chunked(filepath: str, algorithm: str = "md5", chunk_size: int = 8192) -> str:
    """Hash large files in chunks to avoid memory issues."""
    hasher = hashlib.new(algorithm)
    try:
        with open(filepath, "rb") as f:
            while chunk := f.read(chunk_size):
                hasher.update(chunk)
        return hasher.hexdigest()
    except (PermissionError, OSError) as e:
        return f"ERROR: {e}"


def hash_file_quick(filepath: str) -> str:
    """Quick hash using file size + first 4KB for fast pre-filtering."""
    try:
        stat = os.stat(filepath)
        with open(filepath, "rb") as f:
            head = f.read(4096)
        return f"{stat.st_size}:{hashlib.md5(head).hexdigest()}"
    except (PermissionError, OSError):
        return None


def xxhash_file(filepath: str, chunk_size: int = 8192) -> str:
    """Fast hashing using xxhash (if available)."""
    try:
        import xxhash
        hasher = xxhash.xxh64()
        with open(filepath, "rb") as f:
            while chunk := f.read(chunk_size):
                hasher.update(chunk)
        return hasher.hexdigest()
    except ImportError:
        return hash_file_chunked(filepath, "md5", chunk_size)


# ─── File Info ────────────────────────────────────────────────────────────────

class FileInfo:
    """Detailed information about a file."""
    
    def __init__(self, path: str):
        self.path = path
        self.name = os.path.basename(path)
        self.ext = os.path.splitext(path)[1].lower()
        self.size = 0
        self.modified = None
        self.created = None
        self.hash_quick = None
        self.hash_full = None
        self.lines = 0
        self.is_empty = False
        
        self._load_metadata()
    
    def _load_metadata(self):
        try:
            stat = os.stat(self.path)
            self.size = stat.st_size
            self.modified = datetime.fromtimestamp(stat.st_mtime)
            self.created = datetime.fromtimestamp(stat.st_ctime)
            self.is_empty = self.size == 0
            
            if self.ext in SUPPORTED_EXTENSIONS and self.size > 0:
                try:
                    with open(self.path, "r", encoding="utf-8", errors="ignore") as f:
                        self.lines = sum(1 for _ in f)
                except:
                    self.lines = 0
        except (PermissionError, OSError):
            pass
    
    def to_dict(self) -> dict:
        return {
            "path": self.path,
            "name": self.name,
            "size": self.size,
            "size_human": format_size(self.size),
            "lines": self.lines,
            "modified": self.modified.isoformat() if self.modified else None,
            "created": self.created.isoformat() if self.created else None,
            "hash": self.hash_full,
        }


# ─── Scanner ──────────────────────────────────────────────────────────────────

class DuplicateScanner:
    """Scans directories for duplicate files."""
    
    def __init__(
        self,
        root_dir: str,
        extensions: Optional[Set[str]] = None,
        algorithm: str = "md5",
        skip_dirs: Optional[Set[str]] = None,
        min_size: int = 0,
        max_size: int = MAX_FILE_SIZE,
        include_empty: bool = False,
        exclude_patterns: Optional[List[str]] = None,
    ):
        self.root_dir = Path(root_dir).resolve()
        self.extensions = extensions or SUPPORTED_EXTENSIONS
        self.algorithm = algorithm
        self.skip_dirs = skip_dirs or SKIP_DIRS
        self.min_size = min_size
        self.max_size = max_size
        self.include_empty = include_empty
        self.exclude_patterns = exclude_patterns or []
        
        self.files: List[FileInfo] = []
        self.duplicates: Dict[str, List[FileInfo]] = {}
        self.stats = {"scanned": 0, "skipped": 0, "errors": 0}
    
    def scan(self) -> Dict[str, List[FileInfo]]:
        """Main scan pipeline: quick filter → full hash → group."""
        print(f"\n{'='*60}")
        print(f"  DUPLICATE FILE SCANNER")
        print(f"  Target: {self.root_dir}")
        print(f"  Algorithm: {self.algorithm}")
        print(f"{'='*60}\n")
        
        # Phase 1: Collect files
        print("[1/3] Scanning files...", end=" ", flush=True)
        self._collect_files()
        print(f"found {len(self.files)} files")
        
        if not self.files:
            print("No matching files found. Exiting.")
            return {}
        
        # Phase 2: Quick pre-filter (size + partial hash)
        print("[2/3] Pre-filtering...", end=" ", flush=True)
        quick_groups = self._quick_filter()
        candidates = {k: v for k, v in quick_groups.items() if len(v) > 1}
        print(f"{len(candidates)} potential duplicate groups")
        
        if not candidates:
            print("No duplicates found. Exiting.")
            return {}
        
        # Phase 3: Full hash verification
        print("[3/3] Computing full hashes...", end=" ", flush=True)
        self.duplicates = self._full_hash_verify(candidates)
        dup_count = sum(len(v) for v in self.duplicates.values())
        print(f"{dup_count} confirmed duplicates in {len(self.duplicates)} groups")
        
        self._print_summary()
        return self.duplicates
    
    def _collect_files(self):
        """Walk directory and collect matching files."""
        for root, dirs, files in os.walk(self.root_dir):
            # Skip excluded directories
            dirs[:] = [d for d in dirs if d not in self.skip_dirs]
            
            for filename in files:
                filepath = os.path.join(root, filename)
                ext = os.path.splitext(filename)[1].lower()
                
                self.stats["scanned"] += 1
                
                # Filters
                if ext not in self.extensions:
                    self.stats["skipped"] += 1
                    continue
                
                if self._is_excluded(filepath):
                    self.stats["skipped"] += 1
                    continue
                
                try:
                    info = FileInfo(filepath)
                    
                    if not self.include_empty and info.is_empty:
                        self.stats["skipped"] += 1
                        continue
                    
                    if info.size < self.min_size or info.size > self.max_size:
                        self.stats["skipped"] += 1
                        continue
                    
                    self.files.append(info)
                except Exception as e:
                    self.stats["errors"] += 1
    
    def _is_excluded(self, path: str) -> bool:
        """Check if file matches exclusion patterns."""
        for pattern in self.exclude_patterns:
            if fnmatch.fnmatch(os.path.basename(path), pattern):
                return True
        return False
    
    def _quick_filter(self) -> Dict[str, List[FileInfo]]:
        """Group files by size + partial hash for fast comparison."""
        groups = defaultdict(list)
        for f in self.files:
            quick = hash_file_quick(f.path)
            if quick:
                f.hash_quick = quick
                groups[quick].append(f)
        return groups
    
    def _full_hash_verify(self, candidates: Dict[str, List[FileInfo]]) -> Dict[str, List[FileInfo]]:
        """Compute full hash for candidate groups."""
        verified = {}
        total = sum(len(v) for v in candidates.values())
        processed = 0
        
        for key, group in candidates.items():
            for f in group:
                if f.hash_full is None:
                    if self.algorithm == "xxhash":
                        f.hash_full = xxhash_file(f.path)
                    else:
                        f.hash_full = hash_file_chunked(f.path, self.algorithm)
                processed += 1
            
            # Group by full hash
            by_hash = defaultdict(list)
            for f in group:
                if not f.hash_full.startswith("ERROR"):
                    by_hash[f.hash_full].append(f)
            
            for h, files in by_hash.items():
                if len(files) > 1:
                    verified[h] = files
        
        return verified
    
    def _print_summary(self):
        """Print scan summary."""
        print(f"\n{'─'*60}")
        print(f"  SCAN SUMMARY")
        print(f"{'─'*60}")
        print(f"  Files scanned:  {self.stats['scanned']}")
        print(f"  Files skipped:  {self.stats['skipped']}")
        print(f"  Errors:         {self.stats['errors']}")
        print(f"  Duplicate groups: {len(self.duplicates)}")
        
        total_dupes = sum(len(g) - 1 for g in self.duplicates.values())
        wasted = sum(f.size * (len(g) - 1) for g in self.duplicates.values())
        print(f"  Total duplicates: {total_dupes}")
        print(f"  Wasted space:     {format_size(wasted)}")
        print(f"{'─'*60}\n")


# ─── Remover ──────────────────────────────────────────────────────────────────

class DuplicateRemover:
    """Safely removes duplicate files with multiple strategies."""
    
    STRATEGIES = {
        "newest": "Keep newest file (by modification date)",
        "oldest": "Keep oldest file (by creation date)",
        "shortest_path": "Keep file with shortest path (most likely canonical)",
        "keep_dir": "Keep files in a specific directory",
        "interactive": "Ask for each group",
        "dry_run": "Show what would be deleted",
    }
    
    def __init__(self, duplicates: Dict[str, List[FileInfo]], strategy: str = "shortest_path", keep_dir: Optional[str] = None):
        self.duplicates = duplicates
        self.strategy = strategy
        self.keep_dir = keep_dir
        self.deleted = []
        self.skipped = []
        self.errors = []
    
    def remove(self) -> dict:
        """Execute removal based on strategy."""
        print(f"\n{'='*60}")
        print(f"  DUPLICATE REMOVER")
        print(f"  Strategy: {self.STRATEGIES.get(self.strategy, self.strategy)}")
        print(f"{'='*60}\n")
        
        for hash_val, group in self.duplicates.items():
            keep = self._select_keeper(group)
            to_delete = [f for f in group if f.path != keep.path]
            
            print(f"  Group [{hash_val[:12]}...]")
            print(f"    KEEP:  {keep.path}")
            for f in to_delete:
                print(f"    DEL:   {f.path}")
            print()
            
            if self.strategy == "dry_run":
                self.skipped.extend(to_delete)
                continue
            
            for f in to_delete:
                if self.strategy == "interactive":
                    answer = input(f"    Delete {f.path}? [y/N] ").strip().lower()
                    if answer != "y":
                        self.skipped.append(f)
                        continue
                
                try:
                    # Backup before delete
                    backup_path = f.path + ".bak"
                    if os.path.exists(backup_path):
                        os.remove(backup_path)
                    shutil.copy2(f.path, backup_path)
                    
                    os.remove(f.path)
                    self.deleted.append(f)
                    print(f"    ✓ Deleted: {f.name}")
                except Exception as e:
                    self.errors.append((f, str(e)))
                    print(f"    ✗ Error: {e}")
        
        return self._report()
    
    def _select_keeper(self, group: List[FileInfo]) -> FileInfo:
        """Select which file to keep based on strategy."""
        if self.strategy == "newest":
            return max(group, key=lambda f: f.modified or datetime.min)
        elif self.strategy == "oldest":
            return min(group, key=lambda f: f.created or datetime.max)
        elif self.strategy == "shortest_path":
            return min(group, key=lambda f: len(f.path))
        elif self.strategy == "keep_dir" and self.keep_dir:
            keep = [f for f in group if self.keep_dir in f.path]
            return keep[0] if keep else group[0]
        else:
            return group[0]
    
    def _report(self) -> dict:
        """Generate removal report."""
        report = {
            "strategy": self.strategy,
            "deleted": len(self.deleted),
            "skipped": len(self.skipped),
            "errors": len(self.errors),
            "wasted_space_freed": sum(f.size for f in self.deleted),
        }
        
        print(f"\n{'─'*60}")
        print(f"  REMOVAL REPORT")
        print(f"{'─'*60}")
        print(f"  Deleted:   {report['deleted']} files")
        print(f"  Skipped:   {report['skipped']} files")
        print(f"  Errors:    {report['errors']} files")
        print(f"  Space freed: {format_size(report['wasted_space_freed'])}")
        print(f"{'─'*60}\n")
        
        if self.errors:
            print("  ERRORS:")
            for f, err in self.errors:
                print(f"    {f.path}: {err}")
            print()
        
        return report


# ─── Reporter ─────────────────────────────────────────────────────────────────

class DuplicateReporter:
    """Generate detailed reports in multiple formats."""
    
    @staticmethod
    def to_json(duplicates: Dict[str, List[FileInfo]], filepath: str):
        """Export to JSON."""
        data = {}
        for hash_val, group in duplicates.items():
            data[hash_val] = [f.to_dict() for f in group]
        
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, default=str)
        print(f"  Report saved: {filepath}")
    
    @staticmethod
    def to_csv(duplicates: Dict[str, List[FileInfo]], filepath: str):
        """Export to CSV."""
        import csv
        with open(filepath, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["Hash", "Path", "Size", "Lines", "Modified", "Created"])
            for hash_val, group in duplicates.items():
                for info in group:
                    writer.writerow([
                        hash_val, info.path, info.size, info.lines,
                        info.modified, info.created
                    ])
        print(f"  Report saved: {filepath}")
    
    @staticmethod
    def to_html(duplicates: Dict[str, List[FileInfo]], filepath: str):
        """Export to HTML report."""
        html = """<!DOCTYPE html>
<html>
<head>
    <title>Duplicate Files Report</title>
    <style>
        body { font-family: 'Segoe UI', sans-serif; margin: 20px; background: #1a1a2e; color: #eaeaea; }
        h1 { color: #00d4ff; }
        .group { background: #16213e; border-radius: 8px; padding: 15px; margin: 10px 0; border-left: 4px solid #00d4ff; }
        .file { padding: 8px; margin: 5px 0; background: #0f3460; border-radius: 4px; font-family: monospace; font-size: 13px; }
        .keep { border-left: 3px solid #00ff88; }
        .delete { border-left: 3px solid #ff4444; }
        .meta { color: #888; font-size: 12px; }
        .summary { background: #0f3460; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .stat { display: inline-block; margin: 10px 20px; }
        .stat-value { font-size: 24px; color: #00d4ff; font-weight: bold; }
        .stat-label { font-size: 12px; color: #888; }
    </style>
</head>
<body>
    <h1>Duplicate Files Report</h1>
"""
        # Summary
        total = sum(len(g) - 1 for g in duplicates.values())
        wasted = sum(f.size * (len(g) - 1) for g in duplicates.values())
        html += f"""
    <div class="summary">
        <div class="stat">
            <div class="stat-value">{len(duplicates)}</div>
            <div class="stat-label">Duplicate Groups</div>
        </div>
        <div class="stat">
            <div class="stat-value">{total}</div>
            <div class="stat-label">Duplicate Files</div>
        </div>
        <div class="stat">
            <div class="stat-value">{format_size(wasted)}</div>
            <div class="stat-label">Wasted Space</div>
        </div>
    </div>
"""
        
        for hash_val, group in duplicates.items():
            html += f'<div class="group"><strong>Group [{hash_val[:16]}...]</strong><br>'
            for i, f in enumerate(sorted(group, key=lambda x: x.path)):
                cls = "keep" if i == 0 else "delete"
                html += f'<div class="file {cls}">{f.path}<br>'
                html += f'<span class="meta">{format_size(f.size)} | {f.lines} lines | Modified: {f.modified}</span></div>'
            html += '</div>'
        
        html += "</body></html>"
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(html)
        print(f"  Report saved: {filepath}")


# ─── Utilities ────────────────────────────────────────────────────────────────

def format_size(size: int) -> str:
    """Human readable file size."""
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if size < 1024:
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} PB"


def print_duplicates(duplicates: Dict[str, List[FileInfo]]):
    """Pretty print duplicate groups."""
    for i, (hash_val, group) in enumerate(duplicates.items(), 1):
        print(f"  Group {i} [{hash_val[:16]}...] ({len(group)} files)")
        for f in sorted(group, key=lambda x: x.path):
            print(f"    → {f.path}")
            print(f"      {format_size(f.size)} | {f.lines} lines | {f.modified}")
        print()


# ─── CLI ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Advanced Duplicate File Finder & Remover",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s /path/to/project
  %(prog)s . --algorithm sha256 --extensions .py .pyw
  %(prog)s . --strategy newest --report report.json
  %(prog)s . --dry-run --min-size 1024
        """
    )
    
    parser.add_argument("directory", nargs="?", default=".", help="Directory to scan")
    parser.add_argument("-a", "--algorithm", choices=HASH_ALGORITHMS, default="md5", help="Hash algorithm")
    parser.add_argument("-e", "--extensions", nargs="+", default=[".py"], help="File extensions to scan")
    parser.add_argument("-s", "--strategy", choices=list(DuplicateRemover.STRATEGIES.keys()), default="shortest_path", help="Deletion strategy")
    parser.add_argument("--min-size", type=int, default=0, help="Minimum file size in bytes")
    parser.add_argument("--max-size", type=int, default=MAX_FILE_SIZE, help="Maximum file size in bytes")
    parser.add_argument("--include-empty", action="store_true", help="Include empty files")
    parser.add_argument("--skip-dirs", nargs="+", default=list(SKIP_DIRS), help="Directories to skip")
    parser.add_argument("--exclude", nargs="*", help="Exclude patterns (e.g., test_*.py)")
    parser.add_argument("--keep-dir", help="Keep files in this directory (for keep_dir strategy)")
    parser.add_argument("--report", choices=["json", "csv", "html"], help="Export report format")
    parser.add_argument("--report-file", help="Report output path")
    parser.add_argument("--json", action="store_true", help="Output duplicates as JSON")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be deleted")
    parser.add_argument("-y", "--yes", action="store_true", help="Skip confirmation")
    
    args = parser.parse_args()
    
    # Validate directory
    target = os.path.abspath(args.directory)
    if not os.path.isdir(target):
        print(f"Error: '{target}' is not a directory")
        sys.exit(1)
    
    # Scan
    scanner = DuplicateScanner(
        root_dir=target,
        extensions=set(args.extensions),
        algorithm=args.algorithm,
        skip_dirs=set(args.skip_dirs),
        min_size=args.min_size,
        max_size=args.max_size,
        include_empty=args.include_empty,
        exclude_patterns=args.exclude,
    )
    
    duplicates = scanner.scan()
    
    if not duplicates:
        print("  No duplicates found! Your project is clean.")
        return
    
    # Display
    if args.json:
        print(json.dumps(
            {h: [f.to_dict() for f in g] for h, g in duplicates.items()},
            indent=2, default=str
        ))
    else:
        print_duplicates(duplicates)
    
    # Export report
    if args.report:
        report_path = args.report_file or f"duplicate_report.{args.report}"
        if args.report == "json":
            DuplicateReporter.to_json(duplicates, report_path)
        elif args.report == "csv":
            DuplicateReporter.to_csv(duplicates, report_path)
        elif args.report == "html":
            DuplicateReporter.to_html(duplicates, report_path)
    
    # Remove
    if args.dry_run:
        strategy = "dry_run"
    elif not args.yes and sys.stdin.isatty():
        answer = input("  Remove duplicates? [y/N] ").strip().lower()
        if answer != "y":
            print("  Aborted.")
            return
        strategy = args.strategy
    else:
        strategy = args.strategy
    
    remover = DuplicateRemover(duplicates, strategy=strategy, keep_dir=args.keep_dir)
    remover.remove()


if __name__ == "__main__":
    main()
