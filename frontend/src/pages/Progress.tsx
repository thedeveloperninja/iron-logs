import { useMemo, useState } from "react";
import { useBody, useHistory, useRoutines, useSettings, useWorkouts } from "@/api/queries";
import { LineChart } from "@/components/LineChart";
import { avg7, targetWeight } from "@/lib/calc";
import { addDays, diffDays, fmtDay, fmtShort, today } from "@/lib/date";
import { f0, f1 } from "@/lib/format";

export default function ProgressPage() {
  const settings = useSettings().data;
  const body = useBody().data ?? [];
  const workouts = useWorkouts().data ?? [];
  const byDate = useMemo(() => new Map(body.map((b) => [b.date, b])), [body]);

  const t = today();
  const weighIns = body.filter((b) => b.weightKg != null);
  const first = weighIns[0]?.date;
  const start = settings?.startDate ?? first ?? addDays(t, -56);
  const end = settings?.endDate ?? t;
  const span = Math.max(diffDays(start, end), 7);
  const lastDate = weighIns.at(-1)?.date ?? null;
  const cur = lastDate ? avg7(byDate, lastDate) : null;
  const startW = settings?.startWeightKg ?? weighIns[0]?.weightKg ?? null;
  const goal = settings?.goalWeightKg ?? null;
  const lost = cur != null && startW != null ? startW - cur : null;
  const toGo = cur != null && goal != null ? cur - goal : null;
  const daysLeft = settings?.endDate ? Math.max(diffDays(t, settings.endDate), 0) : null;
  const pace = toGo != null && daysLeft ? toGo / (daysLeft / 7) : null;

  const daily = weighIns.filter((b) => b.date >= start && b.date <= end).map((b) => ({ x: diffDays(start, b.date), y: b.weightKg! }));
  const avgLine = weighIns.filter((b) => b.date >= start && b.date <= end).map((b) => ({ x: diffDays(start, b.date), y: avg7(byDate, b.date)! }));
  const tgt = settings && targetWeight(settings, start) != null
    ? [{ x: 0, y: targetWeight(settings, start)! }, { x: span, y: targetWeight(settings, end)! }] : [];
  const ticks = Array.from({ length: Math.floor(span / 14) + 1 }, (_, i) => ({ x: i * 14, label: fmtShort(addDays(start, i * 14)) }));

  // weekly table
  const weeks: JSX.Element[] = [];
  for (let w = 0; w * 7 <= span; w++) {
    const a = addDays(start, w * 7);
    if (a > t) break;
    const days = Array.from({ length: 7 }, (_, i) => addDays(a, i)).filter((d) => d <= end);
    const pick = (k: "weightKg" | "calories" | "proteinG" | "steps") => {
      const v = days.map((d) => byDate.get(d)?.[k]).filter((x): x is number => x != null);
      return v.length ? v.reduce((p, c) => p + c, 0) / v.length : null;
    };
    const aw = pick("weightKg");
    const tw = targetWeight(settings, days.at(-1)!);
    const ws = workouts.filter((x) => x.date >= a && x.date <= days.at(-1)!);
    const sd = ws.reduce((p, c) => p + c.setsDone, 0);
    weeks.push(
      <tr key={a}>
        <td>Wk {w + 1} · {fmtShort(a)}</td><td>{f1(aw)}</td><td>{f1(tw)}</td>
        <td>{aw == null || tw == null ? "–" : aw <= tw + 0.5 ? <span className="status good">On track</span> : <span className="status bad">Behind</span>}</td>
        <td>{f0(pick("calories"))}</td><td>{f0(pick("proteinG"))}</td><td>{f0(pick("steps"))}</td>
        <td>{ws.filter((x) => x.setsDone > 0).length}</td><td>{sd}</td>
      </tr>,
    );
  }

  return (
    <>
      <h1>Progress</h1>
      <div className="tiles">
        <div className="tile"><span className="label">Now (7-day avg)</span><b>{f1(cur)}</b><small>kg{lastDate ? ` · ${fmtShort(lastDate)}` : ""}</small></div>
        <div className="tile"><span className="label">Lost</span><b>{f1(lost)}</b><small>kg since start</small></div>
        <div className="tile"><span className="label">To goal</span><b>{f1(toGo)}</b><small>{goal != null ? `kg to ${f1(goal)}` : "Set a goal in Account"}</small></div>
        <div className="tile"><span className="label">Target today</span><b>{f1(targetWeight(settings, t))}</b><small>straight-line plan</small></div>
        <div className="tile"><span className="label">Needed pace</span><b>{f1(pace)}</b><small>kg / week from now</small></div>
        <div className="tile"><span className="label">Workouts</span><b>{workouts.filter((w) => w.setsDone > 0).length}</b><small>logged in total</small></div>
      </div>

      <section className="card stack">
        <div className="row between"><h3>Body weight</h3>
          <span className="hint"><span style={{ color: "var(--pull)" }}>━</span> 7-day avg · <span style={{ color: "var(--muted)" }}>┅</span> target · dots daily</span></div>
        {daily.length ? (
          <LineChart label="Body weight versus target" x0={0} x1={span} xTicks={ticks} series={[
            { points: tgt, color: "var(--muted)", dashed: true, width: 1.5 },
            { points: daily, color: "var(--line)", dots: true, width: 0 },
            { points: avgLine, color: "var(--pull)", width: 2.5 },
          ]} />
        ) : <div className="empty">Log your weight on the Body tab to see the trend.</div>}
      </section>

      <section className="card stack">
        <h3>Weekly check</h3>
        <div className="tablewrap"><table className="data">
          <thead><tr><th>Week</th><th>Avg kg</th><th>Target</th><th>Status</th><th>kcal</th><th>Protein</th><th>Steps</th><th>Workouts</th><th>Sets</th></tr></thead>
          <tbody>{weeks.length ? weeks.reverse() : <tr><td colSpan={9} className="txt muted">Starts {fmtDay(start)}</td></tr>}</tbody>
        </table></div>
      </section>

      <Strength />
    </>
  );
}

function Strength() {
  const routines = useRoutines().data ?? [];
  const options = useMemo(() => {
    const m = new Map<number, string>();
    routines.forEach((r) => r.exercises.forEach((x) => {
      if (x.exercise.kind === "weight") m.set(x.exercise.id, x.exercise.name);
      if (x.altExercise?.kind === "weight") m.set(x.altExercise.id, x.altExercise.name);
    }));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [routines]);
  const [sel, setSel] = useState<number | null>(null);
  const id = sel ?? options[0]?.[0] ?? null;
  const hist = useHistory(id).data ?? [];
  const pts = hist.filter((h) => h.e1rm != null);
  const best = Math.max(0, ...pts.map((h) => h.e1rm!));
  const x0 = pts[0]?.date;

  return (
    <section className="card stack">
      <div className="row between"><h3>Strength</h3>
        {options.length > 0 && (
          <select className="input" style={{ width: "auto", maxWidth: "100%" }} value={id ?? ""} onChange={(e) => setSel(Number(e.target.value))} aria-label="Exercise">
            {options.map(([i, n]) => <option key={i} value={i}>{n}</option>)}
          </select>
        )}</div>
      <p className="hint">Estimated 1-rep max per session (Epley). Holding it flat during a cut means you're keeping muscle.</p>
      {pts.length ? (
        <>
          <LineChart label="Estimated one rep max" series={[{ points: pts.map((h) => ({ x: diffDays(x0!, h.date), y: h.e1rm! })), color: "var(--ink)", dots: true }]}
            xTicks={pts.filter((_, i) => i % Math.ceil(pts.length / 6 || 1) === 0).map((h) => ({ x: diffDays(x0!, h.date), label: fmtShort(h.date) }))} />
          <div className="tablewrap"><table className="data">
            <thead><tr><th>Date</th><th>Sets</th><th>Top kg</th><th>Volume</th><th>e1RM</th></tr></thead>
            <tbody>{hist.slice().reverse().slice(0, 12).map((h) => (
              <tr key={h.date}><td>{fmtShort(h.date)}</td>
                <td className="txt">{h.sets.map((s) => `${f1(s.weightKg)}×${s.reps ?? "–"}`).join(", ")}</td>
                <td>{f1(h.topKg)}</td><td>{f0(h.volumeKg)}</td>
                <td>{f1(h.e1rm)}{h.e1rm === best && best > 0 ? <> <span className="pill pr">Best</span></> : null}</td></tr>
            ))}</tbody>
          </table></div>
        </>
      ) : <div className="empty">{options.length ? "No sets logged for this lift yet." : "Add weighted exercises to a routine to track strength."}</div>}
    </section>
  );
}
