import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { del, put } from "@/api/client";
import { qk, useRoutines } from "@/api/queries";
import type { Color, ExerciseRef, Routine, RoutineIn } from "@/api/types";
import { ExercisePicker } from "@/components/ExercisePicker";
import { ConfirmButton } from "@/components/Sheet";
import { useToast } from "@/hooks/useToast";

interface Item { exercise: ExerciseRef; alt: ExerciseRef | null; sets: string; reps: string; rest: string; }
const COLORS: { v: Color; label: string }[] = [
  { v: "push", label: "Red (push)" }, { v: "pull", label: "Blue (pull)" }, { v: "legs", label: "Green (legs)" }, { v: "other", label: "Amber (other)" },
];

export default function RoutineEditor() {
  const { id } = useParams();
  const routines = useRoutines();
  const r = routines.data?.find((x) => String(x.id) === id);
  if (routines.isLoading) return <div className="empty">Loading…</div>;
  if (!r) return <div className="card empty">Routine not found. <Link to="/routines">Back to routines</Link></div>;
  return <Editor key={r.id} routine={r} />;
}

function Editor({ routine }: { routine: Routine }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const toast = useToast();
  const [name, setName] = useState(routine.name);
  const [focus, setFocus] = useState(routine.focus);
  const [color, setColor] = useState<Color>(routine.color);
  const [items, setItems] = useState<Item[]>(routine.exercises.map((x) => ({
    exercise: x.exercise, alt: x.altExercise, sets: String(x.sets), reps: x.reps, rest: String(x.restSeconds),
  })));
  const [picker, setPicker] = useState<null | { mode: "add" } | { mode: "main" | "alt"; i: number }>(null);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const change = (fn: () => void) => { fn(); setDirty(true); };
  const upd = (i: number, patch: Partial<Item>) => change(() => setItems((xs) => xs.map((x, k) => (k === i ? { ...x, ...patch } : x))));

  const save = useMutation({
    mutationFn: () => put<Routine>(`/routines/${routine.id}`, {
      name: name.trim() || "Routine", focus: focus.trim(), color,
      exercises: items.map((x) => ({
        exerciseId: x.exercise.id, altExerciseId: x.alt?.id ?? null,
        sets: Math.min(20, Math.max(1, parseInt(x.sets) || 3)), reps: x.reps.trim() || "8-12",
        restSeconds: Math.min(900, Math.max(0, parseInt(x.rest) || 90)),
      })),
    } satisfies RoutineIn),
    onSuccess: () => { setDirty(false); void qc.invalidateQueries({ queryKey: qk.routines }); toast("Routine saved."); },
    onError: (e: Error) => toast(e.message),
  });
  const remove = useMutation({
    mutationFn: () => del(`/routines/${routine.id}`),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: qk.routines }); void qc.invalidateQueries({ queryKey: qk.schedule }); nav("/routines"); },
    onError: (e: Error) => toast(e.message),
  });

  return (
    <>
      <div className="row between">
        <Link to="/routines" className="btn small ghost">‹ Routines</Link>
        <button type="button" className="btn primary" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Saving…" : dirty ? "Save changes" : "Saved"}
        </button>
      </div>
      <section className={`banner t-${color}`}>
        <div className="grid2">
          <label className="field"><span className="label">Name</span><input value={name} maxLength={60} onChange={(e) => change(() => setName(e.target.value))} /></label>
          <label className="field"><span className="label">Colour</span>
            <select value={color} onChange={(e) => change(() => setColor(e.target.value as Color))}>
              {COLORS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
            </select></label>
        </div>
        <label className="field"><span className="label">Focus</span><input value={focus} maxLength={120} placeholder="e.g. Chest · Shoulders · Triceps" onChange={(e) => change(() => setFocus(e.target.value))} /></label>
      </section>

      {items.map((x, i) => (
        <div key={i} className={`card stack b-${color}`} style={{ gap: 8 }}>
          <div className="row between">
            <span className="label">Exercise {i + 1}</span>
            <div className="row" style={{ gap: 4 }}>
              <button type="button" className="btn small ghost" disabled={i === 0} aria-label="Move up"
                onClick={() => change(() => setItems((xs) => { const n = [...xs]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; }))}>↑</button>
              <button type="button" className="btn small ghost" disabled={i === items.length - 1} aria-label="Move down"
                onClick={() => change(() => setItems((xs) => { const n = [...xs]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n; }))}>↓</button>
              <button type="button" className="btn small ghost danger" onClick={() => change(() => setItems((xs) => xs.filter((_, k) => k !== i)))}>Delete</button>
            </div>
          </div>
          <button type="button" className="btn" style={{ justifyContent: "flex-start" }} onClick={() => setPicker({ mode: "main", i })}>
            <b>{x.exercise.name}</b>
          </button>
          <div className="row">
            <span className="hint">Alternative:</span>
            <button type="button" className="btn small" onClick={() => setPicker({ mode: "alt", i })}>{x.alt ? x.alt.name : "+ Add alternative"}</button>
            {x.alt && <button type="button" className="btn small ghost" onClick={() => upd(i, { alt: null })}>Remove</button>}
          </div>
          <div className="grid3">
            <label className="field"><span className="label">Sets</span><input inputMode="numeric" value={x.sets} onChange={(e) => upd(i, { sets: e.target.value })} /></label>
            <label className="field"><span className="label">{x.exercise.kind === "time" ? "Seconds" : "Reps"}</span><input value={x.reps} maxLength={16} placeholder="8-12" onChange={(e) => upd(i, { reps: e.target.value })} /></label>
            <label className="field"><span className="label">Rest (sec)</span><input inputMode="numeric" value={x.rest} onChange={(e) => upd(i, { rest: e.target.value })} /></label>
          </div>
        </div>
      ))}
      <button type="button" className="btn block" onClick={() => setPicker({ mode: "add" })}>+ Add exercise</button>
      <div className="row between">
        <ConfirmButton label="Delete routine" confirmLabel="Delete" question="Delete this routine? Logged workouts are kept." onConfirm={() => remove.mutate()} />
        <button type="button" className="btn primary" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>Save changes</button>
      </div>

      {picker && (
        <ExercisePicker titleText={picker.mode === "alt" ? "Choose alternative" : "Choose exercise"} onClose={() => setPicker(null)}
          onPick={(e) => {
            const ref: ExerciseRef = { id: e.id, slug: e.slug, name: e.name, kind: e.kind };
            if (picker.mode === "add") change(() => setItems((xs) => [...xs, { exercise: ref, alt: null, sets: "3", reps: e.kind === "time" ? "30" : "8-12", rest: "90" }]));
            else if (picker.mode === "main") upd(picker.i, { exercise: ref });
            else upd(picker.i, { alt: ref });
            setPicker(null);
          }} />
      )}
    </>
  );
}
