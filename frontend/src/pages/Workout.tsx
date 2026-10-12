import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  qk, useContext as useExerciseContext, useExercises, useRoutines, useSchedule, useWorkout, useWorkouts,
} from "@/api/queries";
import type { Color, Exercise, ExerciseContext, ExerciseRef, Kind, Routine, Workout, WorkoutSummary } from "@/api/types";
import { DateNav } from "@/components/DateNav";
import { ExerciseDetail } from "@/components/ExerciseDemo";
import { ExercisePicker } from "@/components/ExercisePicker";
import { ConfirmButton, Sheet } from "@/components/Sheet";
import { queued, useAutosave } from "@/hooks/useAutosave";
import { useRestTimer } from "@/hooks/useRestTimer";
import { useToast } from "@/hooks/useToast";
import { defaultReps, setStats } from "@/lib/calc";
import { fmtShort, isValid, today, weekday } from "@/lib/date";
import { f0, f1, mmss, toNum } from "@/lib/format";

/* ---------------- draft model (strings while typing) ---------------- */
interface DSet { kg: string; reps: string; done: boolean; rir: number | null; }
interface DEx { exercise: ExerciseRef; swap: ExerciseRef | null; targetReps: string; restSeconds: number; note: string; sets: DSet[]; }
interface Draft {
  routineId: number | null; name: string; color: Color; notes: string;
  startedAt: string | null; finishedAt: string | null; exercises: DEx[]; virtual: boolean;
}
interface WorkoutIn {
  routineId: number | null; name: string; color: Color; notes: string | null; startedAt: string | null; finishedAt: string | null;
  exercises: { exerciseId: number; swapExerciseId: number | null; targetReps: string; restSeconds: number; note: string | null;
    sets: { weightKg: number | null; reps: number | null; rir: number | null; done: boolean }[] }[];
}

const emptySet = (): DSet => ({ kg: "", reps: "", done: false, rir: null });
const numStr = (n: number | null) => (n == null ? "" : String(n));

function fromRoutine(r: Routine): Draft {
  return {
    routineId: r.id, name: r.name, color: r.color, notes: "", startedAt: null, finishedAt: null, virtual: true,
    exercises: r.exercises.map((x) => ({
      exercise: x.exercise, swap: x.altExercise, targetReps: x.reps, restSeconds: x.restSeconds, note: "",
      sets: Array.from({ length: x.sets }, emptySet),
    })),
  };
}
function fromServer(w: Workout): Draft {
  return {
    routineId: w.routineId, name: w.name, color: w.color, notes: w.notes ?? "", startedAt: w.startedAt, finishedAt: w.finishedAt,
    virtual: false,
    exercises: w.exercises.map((x) => ({
      exercise: x.exercise, swap: x.swapExercise, targetReps: x.targetReps, restSeconds: x.restSeconds, note: x.note ?? "",
      sets: x.sets.map((s) => ({ kg: numStr(s.weightKg), reps: numStr(s.reps), done: s.done, rir: s.rir })),
    })),
  };
}
function fromQueued(w: WorkoutIn, lib: Map<number, Exercise>): Draft | null {
  const ref = (id: number | null) => (id == null ? null : lib.get(id) ?? null);
  if (w.exercises.some((x) => !lib.has(x.exerciseId))) return null;
  return {
    routineId: w.routineId, name: w.name, color: w.color, notes: w.notes ?? "", startedAt: w.startedAt, finishedAt: w.finishedAt,
    virtual: false,
    exercises: w.exercises.map((x) => ({
      exercise: ref(x.exerciseId)!, swap: ref(x.swapExerciseId), targetReps: x.targetReps, restSeconds: x.restSeconds,
      note: x.note ?? "", sets: x.sets.map((s) => ({ kg: numStr(s.weightKg), reps: numStr(s.reps), done: s.done, rir: s.rir })),
    })),
  };
}
function toIn(d: Draft): WorkoutIn {
  return {
    routineId: d.routineId, name: d.name, color: d.color, notes: d.notes || null, startedAt: d.startedAt, finishedAt: d.finishedAt,
    exercises: d.exercises.map((x) => ({
      exerciseId: x.exercise.id, swapExerciseId: x.swap?.id ?? null, targetReps: x.targetReps, restSeconds: x.restSeconds,
      note: x.note || null,
      sets: x.sets.map((s) => ({ weightKg: toNum(s.kg), reps: s.reps === "" ? null : Math.round(toNum(s.reps) ?? 0), rir: s.rir, done: s.done })),
    })),
  };
}
const kgLabel = (k: Kind) => (k === "weight" ? "kg" : k === "assist" ? "Assist" : "");
const repLabel = (k: Kind) => (k === "time" ? "Sec" : "Reps");

/* ---------------- page ---------------- */
export default function WorkoutPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("d");
  const date = isValid(raw) ? raw : today();
  const setDate = (d: string) => setParams(d === today() ? {} : { d }, { replace: true });

  const routines = useRoutines();
  const schedule = useSchedule();
  const summaries = useWorkouts();
  const workout = useWorkout(date);
  const lib = useExercises();

  const byDate = useMemo(() => new Map((summaries.data ?? []).map((s) => [s.date, s])), [summaries.data]);
  const routineById = useMemo(() => new Map((routines.data ?? []).map((r) => [r.id, r])), [routines.data]);
  const scheduled = (d: string): Routine | null => {
    const id = schedule.data?.[weekday(d)];
    return id != null ? routineById.get(id) ?? null : null;
  };
  const info = (d: string) => {
    const s: WorkoutSummary | undefined = byDate.get(d);
    if (s) return { label: s.name, color: s.color, done: s.setsDone > 0 };
    const r = scheduled(d);
    return r ? { label: r.name, color: r.color } : { label: "Rest", color: "rest" as const };
  };

  const ready = routines.data && schedule.data && workout.isFetched && lib.data;
  return (
    <>
      <DateNav date={date} onChange={setDate} info={info} />
      {workout.isError && <div className="card err">Couldn't load this day: {(workout.error as Error).message}</div>}
      {!ready ? <div className="empty">Loading…</div> : (
        <Day key={date} date={date} server={workout.data ?? null} scheduled={scheduled(date)}
          routines={routines.data!} lib={lib.data!} />
      )}
    </>
  );
}

function Day({ date, server, scheduled, routines, lib }: {
  date: string; server: Workout | null; scheduled: Routine | null; routines: Routine[]; lib: Exercise[];
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const timer = useRestTimer();
  const libMap = useMemo(() => new Map(lib.map((e) => [e.id, e])), [lib]);
  const path = `/workouts/${date}`;
  const { save, remove, state } = useAutosave<WorkoutIn>(path, 700, (result) => {
    if (result) qc.setQueryData(qk.workout(date), result as Workout);
    void qc.invalidateQueries({ queryKey: qk.workouts });
  });

  const [draft, setDraft] = useState<Draft | null>(() => {
    const pending = queued<WorkoutIn>(path);
    if (pending) { const d = fromQueued(pending, libMap); if (d) return d; }
    if (server) return fromServer(server);
    return scheduled ? fromRoutine(scheduled) : null;
  });
  // A refetch can deliver the saved workout after this view opened from a stale cache: adopt it
  // unless the user has already started editing here.
  useEffect(() => {
    if (server && (draft === null || draft.virtual) && !queued(path)) setDraft(fromServer(server));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server]);
  const [picker, setPicker] = useState<null | { mode: "add" } | { mode: "replace"; index: number }>(null);
  const [howTo, setHowTo] = useState<Exercise | null>(null);

  const ids = useMemo(() => [...new Set((draft?.exercises ?? []).map((x) => x.exercise.id))].sort((a, b) => a - b), [draft]);
  const ctxQ = useExerciseContext(date, ids);
  const ctx = useMemo(() => new Map((ctxQ.data ?? []).map((c) => [c.exerciseId, c])), [ctxQ.data]);

  const commit = (next: Draft) => {
    const d = { ...next, virtual: false, startedAt: next.startedAt ?? new Date().toISOString() };
    setDraft(d);
    save(toIn(d));
  };
  const edit = (fn: (d: Draft) => void) => {
    if (!draft) return;
    const d: Draft = structuredClone(draft);
    fn(d);
    commit(d);
  };

  const startRoutine = (value: string) => {
    if (draft && draft.exercises.some((x) => x.sets.some((s) => s.done))) {
      toast("Clear the day first to switch a workout you've started.");
      return;
    }
    if (value === "empty") commit({ routineId: null, name: "Workout", color: "other", notes: "", startedAt: null, finishedAt: null, exercises: [], virtual: false });
    else { const r = routines.find((x) => String(x.id) === value); if (r) commit(fromRoutine(r)); }
  };

  const routineSelect = (
    <select className="input" style={{ width: "auto" }} value="" onChange={(e) => startRoutine(e.target.value)} aria-label="Start a routine">
      <option value="">{draft ? "Switch routine…" : "Start a workout…"}</option>
      {routines.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      <option value="empty">Empty workout</option>
    </select>
  );

  if (!draft) {
    return (
      <section className="banner t-rest">
        <span className="kicker c-rest">Rest day</span>
        <h2>Recover</h2>
        <p className="muted">Nothing scheduled. Walk, stretch and log your steps on the Body tab, or start a workout anyway.</p>
        <div className="row">{routineSelect}</div>
        {!routines.length && <p className="hint">You have no routines yet. Create one on the Routines tab.</p>}
      </section>
    );
  }

  let done = 0, total = 0, volume = 0, prs = 0;
  draft.exercises.forEach((x) => {
    const st = setStats(x.exercise.kind, x.sets.map((s) => ({ weightKg: toNum(s.kg), reps: toNum(s.reps), rir: s.rir, done: s.done })));
    done += st.done; total += x.sets.length; volume += st.volume;
    const best = ctx.get(x.exercise.id)?.bestE1rm;
    if (best && st.best > best + 0.01) prs++;
  });
  const pct = total ? Math.round((100 * done) / total) : 0;
  const routine = routines.find((r) => r.id === draft.routineId);
  const saveText = { idle: "", pending: "Saving…", saving: "Saving…", saved: "Saved", offline: "Saved on phone · will sync", error: "Save failed" }[state];

  const toggleDone = (ei: number, si: number) => {
    const x = draft.exercises[ei], s = x.sets[si];
    if (!s.done) {
      const prev = ctx.get(x.exercise.id)?.previous?.sets[si];
      const kind = x.exercise.kind;
      const next: DSet = { ...s };
      if (next.reps === "") next.reps = numStr(prev?.reps ?? defaultReps(x.targetReps));
      if (next.kg === "" && (kind === "weight" || kind === "assist") && prev?.weightKg != null) next.kg = String(prev.weightKg);
      if (kind === "weight" && next.kg === "") { toast("Enter the weight first."); return; }
      if (next.reps === "") { toast(`Enter the ${kind === "time" ? "seconds" : "reps"} first.`); return; }
      next.done = true;
      edit((d) => { d.exercises[ei].sets[si] = next; });
      const nextSet = x.sets.findIndex((z, i) => i !== si && !z.done);
      const nextEx = draft.exercises.slice(ei + 1).find((z) => z.sets.some((q) => !q.done));
      if (nextSet >= 0) timer.start(x.restSeconds, `${x.exercise.name} · set ${nextSet + 1}`);
      else if (nextEx) timer.start(x.restSeconds, nextEx.exercise.name);
    } else {
      edit((d) => { d.exercises[ei].sets[si].done = false; });
    }
  };

  return (
    <>
      <section className={`banner t-${draft.color}`}>
        <div className="row between">
          <span className={`kicker c-${draft.color}`}>{routine?.focus || (draft.virtual ? "Planned" : "Workout")}</span>
          {routineSelect}
        </div>
        <h2>{draft.name}</h2>
        <div className="stats">
          <div className="stat"><b>{done}/{total}</b><span>Sets</span></div>
          <div className="stat"><b>{f0(volume)}</b><span>Volume kg</span></div>
          <div className="stat"><b>{prs}</b><span>PRs</span></div>
        </div>
        <div className="bar"><i style={{ width: `${pct}%` }} /></div>
        <div className="row between">
          {draft.finishedAt ? <span className="pill good">Finished</span> : <span className="hint">{draft.virtual ? "Tick a set to start logging" : "In progress"}</span>}
          <span className="hint" aria-live="polite">{saveText}</span>
        </div>
      </section>

      {draft.exercises.map((x, ei) => (
        <ExerciseCard key={ei} x={x} ei={ei} color={draft.color} ctx={ctx.get(x.exercise.id)}
          onToggle={(si) => toggleDone(ei, si)}
          onSet={(si, field, v) => edit((d) => { d.exercises[ei].sets[si][field] = v; })}
          onAddSet={() => edit((d) => { const last = d.exercises[ei].sets.at(-1); d.exercises[ei].sets.push({ ...emptySet(), kg: last?.kg ?? "" }); })}
          onRemoveSet={() => edit((d) => { d.exercises[ei].sets.pop(); })}
          onCopyLast={() => edit((d) => {
            const prev = ctx.get(x.exercise.id)?.previous?.sets ?? [];
            d.exercises[ei].sets.forEach((s, i) => { const p = prev[i]; if (p && !s.done) { s.kg = numStr(p.weightKg); s.reps = numStr(p.reps); } });
          })}
          onSwap={() => edit((d) => { const e = d.exercises[ei]; if (!e.swap) return; [e.exercise, e.swap] = [e.swap, e.exercise]; e.sets.forEach((s) => { if (!s.done) s.kg = ""; }); })}
          onNote={(v) => edit((d) => { d.exercises[ei].note = v; })}
          onRemove={() => edit((d) => { d.exercises.splice(ei, 1); })}
          onMove={(dir) => edit((d) => { const j = ei + dir; if (j < 0 || j >= d.exercises.length) return; [d.exercises[ei], d.exercises[j]] = [d.exercises[j], d.exercises[ei]]; })}
          onReplace={() => setPicker({ mode: "replace", index: ei })}
          onHowTo={() => setHowTo(libMap.get(x.exercise.id) ?? null)}
          isFirst={ei === 0} isLast={ei === draft.exercises.length - 1}
        />
      ))}

      <button type="button" className="btn block" onClick={() => setPicker({ mode: "add" })}>+ Add exercise</button>

      <div className="card stack">
        <label className="field"><span className="label">Workout notes</span>
          <textarea rows={2} value={draft.notes} placeholder="Energy, sleep, anything worth remembering"
            onChange={(e) => edit((d) => { d.notes = e.target.value; })} />
        </label>
      </div>

      <div className="row">
        {draft.finishedAt
          ? <button type="button" className="btn" onClick={() => edit((d) => { d.finishedAt = null; })}>Reopen workout</button>
          : <button type="button" className="btn primary grow" disabled={!done} onClick={() => {
              timer.stop();
              edit((d) => { d.finishedAt = new Date().toISOString(); });
              toast(`Workout saved: ${done} sets, ${f0(volume)} kg${prs ? `, ${prs} PR${prs > 1 ? "s" : ""}` : ""}.`);
            }}>Finish workout</button>}
        {!draft.virtual && (
          <ConfirmButton label="Clear day" confirmLabel="Clear" question="Delete everything logged on this day?"
            onConfirm={async () => {
              try { await remove(); } catch { /* queued */ }
              setDraft(scheduled ? fromRoutine(scheduled) : null);
              void qc.invalidateQueries({ queryKey: qk.workouts });
              qc.setQueryData(qk.workout(date), null);
            }} />
        )}
      </div>

      {picker && (
        <ExercisePicker titleText={picker.mode === "add" ? "Add exercise" : "Replace exercise"} onClose={() => setPicker(null)}
          onPick={(e) => {
            const ref: ExerciseRef = { id: e.id, slug: e.slug, name: e.name, kind: e.kind };
            if (picker.mode === "add") {
              edit((d) => { d.exercises.push({ exercise: ref, swap: null, targetReps: e.kind === "time" ? "30" : "8-12", restSeconds: 90, note: "", sets: [emptySet(), emptySet(), emptySet()] }); });
            } else {
              const i = picker.index;
              edit((d) => { d.exercises[i].exercise = ref; d.exercises[i].sets.forEach((s) => { if (!s.done) s.kg = ""; }); });
            }
            setPicker(null);
          }} />
      )}
      {howTo && <Sheet title={howTo.name} onClose={() => setHowTo(null)}><ExerciseDetail exercise={howTo} /></Sheet>}
    </>
  );
}

function ExerciseCard(p: {
  x: DEx; ei: number; color: Color; ctx: ExerciseContext | undefined; isFirst: boolean; isLast: boolean;
  onToggle: (si: number) => void; onSet: (si: number, field: "kg" | "reps", v: string) => void;
  onAddSet: () => void; onRemoveSet: () => void; onCopyLast: () => void; onSwap: () => void; onNote: (v: string) => void;
  onRemove: () => void; onMove: (dir: -1 | 1) => void; onReplace: () => void; onHowTo: () => void;
}) {
  const { x, ei, ctx } = p;
  const kind = x.exercise.kind;
  const [menu, setMenu] = useState(false);
  const prev = ctx?.previous;
  const st = setStats(kind, x.sets.map((s) => ({ weightKg: toNum(s.kg), reps: toNum(s.reps), rir: s.rir, done: s.done })));
  const isPR = kind === "weight" && !!ctx?.bestE1rm && st.best > ctx.bestE1rm + 0.01;
  useEffect(() => { if (!menu) return; const t = window.setTimeout(() => setMenu(false), 6000); return () => window.clearTimeout(t); }, [menu]);

  return (
    <article className={`ex b-${p.color}`}>
      <div className="ex-h">
        <div className="t">
          <div className="row" style={{ gap: 6 }}>
            <h3>{x.exercise.name}</h3>
            {isPR && <span className="pill pr">PR</span>}
          </div>
          <div className="ex-meta">
            {x.sets.length} × {x.targetReps}{kind === "time" ? " sec" : ""} · rest {mmss(x.restSeconds)}
            {prev && <> · last {fmtShort(prev.date)}</>}
            {ctx?.bestE1rm && kind === "weight" ? <> · best e1RM {f1(ctx.bestE1rm)}</> : null}
          </div>
          <div className="row" style={{ gap: 6 }}>
            {x.swap && <button type="button" className="swap" onClick={p.onSwap}>Swap to <b>{x.swap.name}</b></button>}
            <button type="button" className="swap" onClick={p.onHowTo}>How to</button>
          </div>
        </div>
        <button type="button" className="iconbtn" aria-label="Exercise options" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>⋯</button>
      </div>
      {menu && (
        <div className="row" style={{ padding: "0 12px 8px" }}>
          <button type="button" className="btn small" onClick={() => { setMenu(false); p.onReplace(); }}>Replace</button>
          <button type="button" className="btn small" disabled={p.isFirst} onClick={() => p.onMove(-1)}>Move up</button>
          <button type="button" className="btn small" disabled={p.isLast} onClick={() => p.onMove(1)}>Move down</button>
          <ConfirmButton label="Remove" confirmLabel="Remove" question="Remove this exercise?" className="btn small danger"
            onConfirm={() => { setMenu(false); p.onRemove(); }} />
        </div>
      )}
      <table className="sets">
        <thead><tr>
          <th>Set</th><th className="l">Previous</th>{kgLabel(kind) && <th>{kgLabel(kind)}</th>}<th>{repLabel(kind)}</th><th>✓</th>
        </tr></thead>
        <tbody>
          {x.sets.map((s, si) => {
            const ps = prev?.sets[si];
            const pTxt = ps ? (ps.weightKg != null && kgLabel(kind) ? `${f1(ps.weightKg)}×${ps.reps ?? "–"}` : `${ps.reps ?? "–"}${kind === "time" ? "s" : ""}`) : "–";
            return (
              <tr key={si} className={s.done ? "done" : ""}>
                <td className="sn">{si + 1}</td>
                <td className="prev">{pTxt}</td>
                {kgLabel(kind) && (
                  <td><input inputMode="decimal" aria-label={`Set ${si + 1} ${kgLabel(kind)}`} id={`kg-${ei}-${si}`}
                    value={s.kg} placeholder={ps?.weightKg != null ? String(ps.weightKg) : ""}
                    onChange={(e) => p.onSet(si, "kg", e.target.value)} /></td>
                )}
                <td><input inputMode="numeric" aria-label={`Set ${si + 1} ${repLabel(kind)}`} id={`rp-${ei}-${si}`}
                  value={s.reps} placeholder={ps?.reps != null ? String(ps.reps) : String(defaultReps(x.targetReps) ?? "")}
                  onChange={(e) => p.onSet(si, "reps", e.target.value)} /></td>
                <td><button type="button" className="chk" onClick={() => p.onToggle(si)} aria-pressed={s.done} aria-label={`Set ${si + 1} done`}>
                  <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="ex-f">
        <button type="button" className="btn small" onClick={p.onAddSet}>+ Set</button>
        {x.sets.length > 1 && <button type="button" className="btn small ghost" onClick={p.onRemoveSet}>− Set</button>}
        {prev && <button type="button" className="btn small ghost" onClick={p.onCopyLast}>Copy last</button>}
        <input className="note" value={x.note} placeholder="Note: seat height, grip, how it felt" aria-label="Exercise note"
          onChange={(e) => p.onNote(e.target.value)} />
      </div>
    </article>
  );
}
