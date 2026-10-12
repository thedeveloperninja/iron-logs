"""Download all exercise demo images so the server can host them itself (no CDN).

Usage:
    python scripts/fetch_exercise_images.py [target_dir]     # default: data/exercise-images

Then set IRONLOG_EXERCISE_IMAGE_DIR to that folder. About 1,750 JPEGs (~120 MB).
Images are from free-exercise-db (Unlicense / public domain).
"""
import json
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/"
target = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "data" / "exercise-images"
items = json.loads((ROOT / "app" / "data" / "exercises.json").read_text())["items"]
paths = [p for e in items for p in e["img"]]


def fetch(rel: str) -> str:
    dest = target / rel
    if dest.exists() and dest.stat().st_size > 0:
        return "skip"
    dest.parent.mkdir(parents=True, exist_ok=True)
    try:
        with urllib.request.urlopen(SRC + urllib.request.quote(rel), timeout=30) as r:
            dest.write_bytes(r.read())
        return "ok"
    except Exception as exc:  # keep going; report at the end
        return f"fail {rel}: {exc}"


with ThreadPoolExecutor(max_workers=16) as pool:
    results = list(pool.map(fetch, paths))
fails = [r for r in results if r.startswith("fail")]
print(f"{results.count('ok')} downloaded, {results.count('skip')} already present, {len(fails)} failed -> {target}")
for f in fails[:20]:
    print(" ", f)
sys.exit(1 if fails else 0)
