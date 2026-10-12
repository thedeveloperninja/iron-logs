"""Build app/data/exercises.json from free-exercise-db (Unlicense / public domain).

Usage:
    python scripts/build_exercises.py [path-or-url-to-exercises.json]

Default source: https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json
"""
import json
import sys
import urllib.request
from pathlib import Path

SRC = sys.argv[1] if len(sys.argv) > 1 else "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json"
OUT = Path(__file__).resolve().parent.parent / "app" / "data" / "exercises.json"

WEIGHTED = {"barbell", "dumbbell", "cable", "machine", "kettlebells", "e-z curl bar", "medicine ball"}
TIMED_WORDS = ("plank", "hold", "walking, treadmill", "bicycling", "stairmaster", "elliptical", "rowing, stationary", "jogging")


KIND_OVERRIDES = {"Split_Squats": "reps", "Dips_-_Triceps_Version": "reps"}


def kind_of(e: dict) -> str:
    if e["id"] in KIND_OVERRIDES:
        return KIND_OVERRIDES[e["id"]]
    n = e["name"].lower()
    if e.get("category") in ("stretching", "cardio") or any(w in n for w in TIMED_WORDS):
        return "time"
    if "assisted" in n and e.get("equipment") in ("machine", "bands", "other"):
        return "assist"
    if e.get("equipment") in WEIGHTED:
        return "weight"
    return "reps"


def main() -> None:
    raw = urllib.request.urlopen(SRC).read() if SRC.startswith("http") else Path(SRC).read_bytes()
    data = json.loads(raw)
    out = []
    for e in sorted(data, key=lambda x: x["name"].lower()):
        out.append({
            "id": e["id"],
            "name": e["name"],
            "eq": e.get("equipment") or "other",
            "cat": e.get("category") or "strength",
            "lvl": e.get("level") or "",
            "mech": e.get("mechanic") or "",
            "pm": e.get("primaryMuscles") or [],
            "sm": e.get("secondaryMuscles") or [],
            "ins": e.get("instructions") or [],
            "img": e.get("images") or [],
            "kind": kind_of(e),
        })
    OUT.write_text(json.dumps({"source": "free-exercise-db (Unlicense)", "count": len(out), "items": out},
                              separators=(",", ":"), ensure_ascii=False))
    print(f"wrote {len(out)} exercises -> {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
