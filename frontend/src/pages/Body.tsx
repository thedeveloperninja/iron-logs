import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { qk, useBody, useSettings } from "@/api/queries";
import type { BodyLog, Settings } from "@/api/types";
import { DateNav } from "@/components/DateNav";
import { queued, useAutosave } from "@/hooks/useAutosave";
import { avg7, targetWeight } from "@/lib/calc";
import { isValid, today, weekday } from "@/lib/date";
import { f0, f1, toNum } from "@/lib/format";

type Field = { key: keyof Omit<BodyLog, "date" | "note">; label: string; ph: string; mode: "decimal" | "numeric" };
const FIELDS: Field[] = [
  { key: "weightKg", label: "Weight (kg)", ph: "e.g. 98.4", mode: "decimal" },
  { key: "calories", label: "Calories", ph: "kcal", mode: "numeric" },
  { key: "proteinG", label: "Protein (g)", ph: "g", mode: "numeric" },
  { key: "steps", label: "Steps", ph: "steps", mode: "numeric" },
  { key: "cardioMin", label: "Cardio (min)", ph: "min", mode: "numeric" },
  { key: "sleepH", label: "Sleep (h)", ph: "7.5", mode: "decimal" },
  { key: "waistCm", label: "Waist (cm)", ph: "weekly", mode: "decimal" },
  { key: "bodyFatPct", label: "Body fat (%)", ph: "optional", mode: "decimal" },
];
const INT_KEYS = new Set(["calories", "proteinG", "steps", "cardioMin"]);

export default function BodyPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("d");
  const date = isValid(raw) ? raw : today();
  const body = useBody();
  const settings = useSettings();
  return (
    <>
      <DateNav date={date} onChange={(d) => setParams(d === today() ? {} : { d }, { replace: true })} />
      {body.isLoading || settings.isLoading ? <div className="empty">Loading…</div> :
        <DayLog key={date} date={date} logs={body.data ?? []} settings={settings.data} />}
    </>
  );
}

function DayLog({ date, logs, settings }: { date: string; logs: BodyLog[]; settings: Settings | undefined }) {
  const qc = useQueryClient();
  const path = `/body/${date}`;
  const byDate = useMemo(() => new Map(logs.map((l) => [l.date, l])), [logs]);
  const initial = queued<Record<string, unknown>>(path) ?? byDate.get(date) ?? {};
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries([...FIELDS.map((f) => [f.key, initial[f.key] == null ? "" : String(initial[f.key])]), ["note", String(initial.note ?? "")]]));
  const { save, state } = useAutosave(path, 800, () => void qc.invalidateQueries({ queryKey: qk.body }));

  const set = (k: string, v: string) => {
    const next = { ...vals, [k]: v };
    setVals(next);
    const payload: Record<string, unknown> = { note: next.note || null };
    for (const f of FIELDS) {
      const n = toNum(next[f.key]);
      payload[f.key] = n == null ? null : INT_KEYS.has(f.key) ? Math.round(n) : n;
    }
    save(payload);
  };

  // include today's unsaved weight in the average
  const merged = new Map(byDate);
  const w = toNum(vals.weightKg);
  merged.set(date, { ...(byDate.get(date) ?? ({ date } as BodyLog)), weightKg: w });
  const avg = avg7(merged, date);
  const tw = targetWeight(settings, date);
  const targets: Partial<Record<Field["key"], { t: number | null | undefined; lowerBetter?: boolean }>> = {
    calories: { t: settings?.calorieTarget, lowerBetter: true },
    proteinG: { t: settings?.proteinTargetG },
    steps: { t: settings?.stepTarget },
    cardioMin: { t: settings?.cardioTargetMin },
  };
  const saveText = { idle: "", pending: "Saving…", saving: "Saving…", saved: "Saved", offline: "Saved on phone · will sync", error: "Save failed" }[state];

  return (
    <>
      <section className="card stack">
        <div className="row between"><h2>Daily log</h2><span className="hint" aria-live="polite">{saveText}</span></div>
        <p className="hint">Weigh in after waking, before food. {weekday(date) === 0 ? "It's Monday: measure your waist too." : ""}</p>
        <div className="grid3">
          {FIELDS.map((f) => {
            const tgt = targets[f.key];
            const n = toNum(vals[f.key]);
            let status: JSX.Element | null = null;
            if (tgt?.t != null && n != null) {
              const ok = tgt.lowerBetter ? n <= tgt.t : n >= tgt.t;
              status = <span className={`status ${ok ? "good" : "bad"}`}>{ok ? "On target" : tgt.lowerBetter ? `${f0(n - tgt.t)} over` : `${f0(tgt.t - n)} short`}</span>;
            } else if (tgt?.t != null) status = <span className="hint">Target {f0(tgt.t)}</span>;
            if (f.key === "weightKg" && tw != null) status = <span className="hint">Target today {f1(tw)}</span>;
            return (
              <label className="field" key={f.key}>
                <span className="label">{f.label}</span>
                <input inputMode={f.mode} value={vals[f.key]} placeholder={f.ph} onChange={(e) => set(f.key, e.target.value)} />
                {status}
              </label>
            );
          })}
        </div>
        <label className="field"><span className="label">Note</span>
          <input value={vals.note} placeholder="Optional" onChange={(e) => set("note", e.target.value)} /></label>
      </section>
      <section className="card row" style={{ gap: 18 }}>
        <div className="stat"><b>{f1(avg)}</b><span>7-day avg</span></div>
        <div className="stat"><b>{f1(tw)}</b><span>Target</span></div>
        {avg != null && tw != null && (
          <span className={`pill ${avg <= tw + 0.5 ? "good" : "bad"}`}>{avg <= tw + 0.5 ? "On track" : `Behind by ${f1(avg - tw)} kg`}</span>
        )}
        {tw == null && <span className="hint">Set start/goal weight and dates in Account to see your target line.</span>}
      </section>
    </>
  );
}
