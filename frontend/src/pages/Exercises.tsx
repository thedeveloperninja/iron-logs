import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { del, post } from "@/api/client";
import { qk, useExercises } from "@/api/queries";
import type { Exercise, Kind } from "@/api/types";
import { ExerciseDetail } from "@/components/ExerciseDemo";
import { ExerciseRow, FilterBar, useExerciseFilter } from "@/components/ExercisePicker";
import { ConfirmButton, Sheet } from "@/components/Sheet";
import { useToast } from "@/hooks/useToast";

export default function ExercisesPage() {
  const { data, isLoading } = useExercises();
  const f = useExerciseFilter(data);
  const [open, setOpen] = useState<Exercise | null>(null);
  const [creating, setCreating] = useState(false);
  const shown = f.list.slice(0, 200);
  return (
    <>
      <div className="row between">
        <div className="row"><Link to="/routines" className="btn small ghost">‹ Routines</Link><h1>Exercises</h1></div>
        <button type="button" className="btn small primary" onClick={() => setCreating(true)}>+ Custom</button>
      </div>
      <p className="hint">{data?.length ?? "…"} exercises with photos and step-by-step instructions. Tap one to see how it's done.</p>
      <FilterBar f={f} />
      {isLoading ? <div className="empty">Loading…</div> : (
        <div className="card exlist" style={{ padding: "0 8px" }}>
          {shown.map((e) => <ExerciseRow key={e.id} e={e} onClick={() => setOpen(e)} />)}
          {f.list.length > shown.length && <p className="hint" style={{ padding: 8 }}>Showing 200 of {f.list.length}. Narrow the search to see more.</p>}
          {!f.list.length && <div className="empty">No match.</div>}
        </div>
      )}
      {open && (
        <Sheet title={open.name} onClose={() => setOpen(null)}>
          <ExerciseDetail exercise={open} />
          {open.custom && <DeleteCustom ex={open} onDone={() => setOpen(null)} />}
        </Sheet>
      )}
      {creating && <CreateCustom onClose={() => setCreating(false)} />}
    </>
  );
}

function DeleteCustom({ ex, onDone }: { ex: Exercise; onDone: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const m = useMutation({
    mutationFn: () => del<{ result: string }>(`/exercises/${ex.id}`),
    onSuccess: (r) => { void qc.invalidateQueries({ queryKey: qk.exercises }); toast(r.result === "archived" ? "Hidden from the library. Past workouts keep it." : "Exercise deleted."); onDone(); },
    onError: (e: Error) => toast(e.message),
  });
  return <ConfirmButton label="Delete custom exercise" confirmLabel="Delete" question="Delete it?" onConfirm={() => m.mutate()} />;
}

function CreateCustom({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Kind>("weight");
  const [equipment, setEquipment] = useState("");
  const [muscles, setMuscles] = useState("");
  const [steps, setSteps] = useState("");
  const m = useMutation({
    mutationFn: () => post<Exercise>("/exercises", {
      name: name.trim(), kind, equipment: equipment.trim() || null,
      primaryMuscles: muscles.split(",").map((s) => s.trim()).filter(Boolean),
      instructions: steps.split("\n").map((s) => s.trim()).filter(Boolean),
    }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: qk.exercises }); toast("Custom exercise added."); onClose(); },
    onError: (e: Error) => toast(e.message),
  });
  return (
    <Sheet title="New custom exercise" onClose={onClose}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); if (name.trim().length >= 2) m.mutate(); }}>
        <label className="field"><span className="label">Name</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required minLength={2} autoFocus /></label>
        <div className="grid2">
          <label className="field"><span className="label">Logged as</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
              <option value="weight">Weight × reps</option><option value="reps">Reps only</option>
              <option value="time">Time (seconds)</option><option value="assist">Assisted (kg help)</option>
            </select></label>
          <label className="field"><span className="label">Equipment</span><input value={equipment} onChange={(e) => setEquipment(e.target.value)} placeholder="e.g. machine" /></label>
        </div>
        <label className="field"><span className="label">Muscles (comma-separated)</span><input value={muscles} onChange={(e) => setMuscles(e.target.value)} placeholder="chest, triceps" /></label>
        <label className="field"><span className="label">How to (one step per line)</span><textarea rows={4} value={steps} onChange={(e) => setSteps(e.target.value)} /></label>
        <button type="submit" className="btn primary" disabled={m.isPending || name.trim().length < 2}>Add exercise</button>
      </form>
    </Sheet>
  );
}
