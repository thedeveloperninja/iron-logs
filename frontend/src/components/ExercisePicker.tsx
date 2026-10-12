import { useDeferredValue, useMemo, useState } from "react";
import type { Exercise } from "@/api/types";
import { useExercises } from "@/api/queries";
import { title } from "@/lib/format";
import { ExerciseDetail, Thumb } from "./ExerciseDemo";
import { Sheet } from "./Sheet";

const MUSCLES = ["chest", "shoulders", "triceps", "lats", "middle back", "biceps", "quadriceps", "hamstrings", "glutes",
  "calves", "abdominals", "lower back", "forearms", "traps"];
const EQUIPMENT = ["barbell", "dumbbell", "cable", "machine", "body only", "kettlebells", "bands", "e-z curl bar"];

/** Common gym names mapped to words used in the library's exercise names. */
const ALIASES: Record<string, string> = {
  "pec deck": "butterfly", "pec fly": "butterfly", "chest fly": "fly", "flyes": "fly",
  "rdl": "romanian deadlift", "sldl": "stiff-legged deadlift", "ohp": "military press", "overhead press": "military press",
  "skull crusher": "lying triceps press", "skullcrusher": "lying triceps press", "lat pull down": "lat pulldown",
  "pull up": "pullup", "pull-up": "pullup", "chin up": "chin-up", "push up": "pushup", "push-up": "pushup",
  "side raise": "lateral raise", "hamstring curl": "leg curl",
  "db": "dumbbell", "bb": "barbell", "kb": "kettlebell",
  "glute bridge": "bridge", "t bar": "t-bar", "seated row": "cable row",
  "ab wheel": "ab roller", "dips": "dip", "tricep": "triceps", "bicep": "biceps",
};
const expand = (q: string) => {
  let t = q.toLowerCase().trim();
  for (const [k, v] of Object.entries(ALIASES)) {
    t = t.replace(new RegExp(`(^|\\s)${k.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")}(?=\\s|$)`, "g"), `$1${v}`);
  }
  return t;
};

export function useExerciseFilter(all: Exercise[] | undefined) {
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState("");
  const [equip, setEquip] = useState("");
  const dq = useDeferredValue(q);
  const list = useMemo(() => {
    if (!all) return [];
    const words = expand(dq).split(/\s+/).filter(Boolean);
    return all.filter((e) => {
      if (muscle && !e.primaryMuscles.includes(muscle)) return false;
      if (equip && e.equipment !== equip) return false;
      const name = e.name.toLowerCase();
      return words.every((w) => name.includes(w));
    }).sort((a, b) => Number(b.custom) - Number(a.custom));
  }, [all, dq, muscle, equip]);
  return { q, setQ, muscle, setMuscle, equip, setEquip, list };
}

export function FilterBar({ f }: { f: ReturnType<typeof useExerciseFilter> }) {
  return (
    <div className="stack" style={{ gap: 8 }}>
      <input className="input" type="search" placeholder="Search 870+ exercises, e.g. incline press" value={f.q}
        onChange={(e) => f.setQ(e.target.value)} aria-label="Search exercises" autoFocus />
      <div className="row" style={{ flexWrap: "nowrap" }}>
        <select className="input" value={f.muscle} onChange={(e) => f.setMuscle(e.target.value)} aria-label="Muscle">
          <option value="">All muscles</option>
          {MUSCLES.map((m) => <option key={m} value={m}>{title(m)}</option>)}
        </select>
        <select className="input" value={f.equip} onChange={(e) => f.setEquip(e.target.value)} aria-label="Equipment">
          <option value="">All equipment</option>
          {EQUIPMENT.map((m) => <option key={m} value={m}>{title(m)}</option>)}
        </select>
      </div>
    </div>
  );
}

export function ExerciseRow({ e, onClick }: { e: Exercise; onClick: () => void }) {
  return (
    <button type="button" className="exrow" onClick={onClick}>
      <Thumb exercise={e} />
      <span className="grow">
        <span className="nm">{e.name}</span>{e.custom && <> <span className="pill alt">Custom</span></>}
        <br /><span className="hint">{[e.primaryMuscles.map(title).join(", "), e.equipment && title(e.equipment)].filter(Boolean).join(" · ")}</span>
      </span>
    </button>
  );
}

/** Searchable exercise library. Tap a row to see the demo, then choose it. */
export function ExercisePicker({ titleText = "Choose exercise", onPick, onClose }: {
  titleText?: string; onPick: (e: Exercise) => void; onClose: () => void;
}) {
  const { data, isLoading } = useExercises();
  const f = useExerciseFilter(data);
  const [preview, setPreview] = useState<Exercise | null>(null);
  const shown = f.list.slice(0, 120);

  if (preview) {
    return (
      <Sheet title={preview.name} onClose={onClose}
        actions={<button type="button" className="btn small" onClick={() => setPreview(null)}>Back</button>}>
        <button type="button" className="btn primary block" onClick={() => onPick(preview)}>Use this exercise</button>
        <ExerciseDetail exercise={preview} />
      </Sheet>
    );
  }
  return (
    <Sheet title={titleText} onClose={onClose}>
      <FilterBar f={f} />
      {isLoading ? <div className="empty">Loading library…</div> : (
        <div className="exlist">
          {shown.map((e) => <ExerciseRow key={e.id} e={e} onClick={() => setPreview(e)} />)}
          {f.list.length > shown.length && <p className="hint" style={{ padding: 8 }}>Showing 120 of {f.list.length}. Narrow the search to see more.</p>}
          {!f.list.length && <div className="empty">No match. Add it as a custom exercise from the Exercises page.</div>}
        </div>
      )}
    </Sheet>
  );
}
