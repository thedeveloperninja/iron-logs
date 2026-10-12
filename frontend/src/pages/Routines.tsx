import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { post, put } from "@/api/client";
import { qk, useRoutines, useSchedule, useTemplates } from "@/api/queries";
import type { Routine, RoutineIn } from "@/api/types";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/hooks/useToast";
import { DOW } from "@/lib/date";

export default function RoutinesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();
  const routines = useRoutines();
  const schedule = useSchedule();
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const saveSchedule = useMutation({
    mutationFn: (days: (number | null)[]) => put<{ days: (number | null)[] }>("/schedule", { days }),
    onSuccess: (r) => qc.setQueryData(qk.schedule, r.days),
    onError: (e: Error) => toast(e.message),
  });
  const reorder = useMutation({
    mutationFn: (ids: number[]) => post("/routines/reorder", { ids }),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.routines }),
  });
  const create = useMutation({
    mutationFn: () => post<Routine>("/routines", { name: "New routine", focus: "", color: "other", exercises: [] } satisfies RoutineIn),
    onSuccess: (r) => { void qc.invalidateQueries({ queryKey: qk.routines }); nav(`/routines/${r.id}`); },
    onError: (e: Error) => toast(e.message),
  });

  const list = routines.data ?? [];
  const days = schedule.data ?? Array(7).fill(null);
  const move = (i: number, dir: -1 | 1) => {
    const ids = list.map((r) => r.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    qc.setQueryData(qk.routines, ids.map((id) => list.find((r) => r.id === id)!));
    reorder.mutate(ids);
  };

  return (
    <>
      <div className="row between">
        <h1>Routines</h1>
        <div className="row">
          <Link to="/exercises" className="btn small">Exercises</Link>
          <button type="button" className="btn small" onClick={() => setTemplatesOpen(true)}>Templates</button>
          <button type="button" className="btn small primary" onClick={() => create.mutate()} disabled={create.isPending}>+ New</button>
        </div>
      </div>

      <section className="card stack">
        <h3>Weekly schedule</h3>
        <p className="hint">Pick what runs each day. The Workout tab opens the scheduled routine automatically.</p>
        <div className="grid3">
          {DOW.map((d, i) => (
            <label key={d} className="field"><span className="label">{d}</span>
              <select value={days[i] ?? ""} onChange={(e) => {
                const next = [...days]; next[i] = e.target.value ? Number(e.target.value) : null; saveSchedule.mutate(next);
              }}>
                <option value="">Rest</option>
                {list.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
          ))}
        </div>
      </section>

      {routines.isLoading ? <div className="empty">Loading…</div> : !list.length ? (
        <div className="card empty stack">
          <p>No routines yet.</p>
          <button type="button" className="btn primary" onClick={() => setTemplatesOpen(true)}>Start from a template</button>
        </div>
      ) : (
        <div className="stack">
          {list.map((r, i) => (
            <div key={r.id} className="listbtn" style={{ padding: 0 }}>
              <span className={`sw ${r.color}`} style={{ marginLeft: 12, alignSelf: "center", height: 40 }} />
              <Link to={`/routines/${r.id}`} className="grow" style={{ padding: 12, color: "inherit", textDecoration: "none" }}>
                <span className={`kicker c-${r.color}`}>{r.focus || "Routine"}</span><br />
                <b style={{ fontFamily: "var(--f-display)", fontSize: 20 }}>{r.name}</b>{" "}
                <span className="muted">· {r.exercises.length} exercises · {r.exercises.reduce((a, x) => a + x.sets, 0)} sets</span>
                <br /><span className="hint">{days.map((d, k) => (d === r.id ? DOW[k] : null)).filter(Boolean).join(", ") || "Not scheduled"}</span>
              </Link>
              <div className="stack" style={{ gap: 4, padding: 8 }}>
                <button type="button" className="btn small ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${r.name} up`}>↑</button>
                <button type="button" className="btn small ghost" disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${r.name} down`}>↓</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {templatesOpen && <TemplatesSheet hasRoutines={list.length > 0} onClose={() => setTemplatesOpen(false)} />}
    </>
  );
}

export function TemplatesSheet({ onClose, hasRoutines, onApplied }: { onClose: () => void; hasRoutines: boolean; onApplied?: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const templates = useTemplates();
  const [replace, setReplace] = useState(true);
  const apply = useMutation({
    mutationFn: (key: string) => post<Routine[]>(`/templates/${key}/apply?replace=${replace && hasRoutines}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.routines });
      void qc.invalidateQueries({ queryKey: qk.schedule });
      toast("Program added. Check the Workout tab.");
      onApplied?.(); onClose();
    },
    onError: (e: Error) => toast(e.message),
  });
  return (
    <Sheet title="Start from a template" onClose={onClose}>
      {hasRoutines && (
        <label className="row"><input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
          <span>Replace my current routines and schedule (logged workouts are kept)</span></label>
      )}
      {(templates.data ?? []).map((t) => (
        <div key={t.key} className="card stack" style={{ gap: 6 }}>
          <div className="row between"><h3>{t.name}</h3><span className="pill alt">{t.daysPerWeek} days/wk</span></div>
          <p className="muted">{t.description}</p>
          <button type="button" className="btn primary" disabled={apply.isPending} onClick={() => apply.mutate(t.key)}>Use this program</button>
        </div>
      ))}
    </Sheet>
  );
}
