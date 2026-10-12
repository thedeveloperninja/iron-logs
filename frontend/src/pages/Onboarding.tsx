import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { put } from "@/api/client";
import { qk, useRoutines, useSettings } from "@/api/queries";
import type { Settings } from "@/api/types";
import { GoalsFields, fromVals, useGoals } from "@/components/GoalsForm";
import { addDays, today } from "@/lib/date";
import { TemplatesSheet } from "./Routines";

/** Two quick steps after sign-up: goals, then a starter program. Both can be skipped. */
export default function Onboarding({ username }: { username: string }) {
  const qc = useQueryClient();
  const settings = useSettings().data;
  const routines = useRoutines().data ?? [];
  const g = useGoals(settings, { startDate: today(), endDate: addDays(today(), 84) });
  const [step, setStep] = useState<1 | 2>(1);
  const [err, setErr] = useState("");
  const [templates, setTemplates] = useState(false);

  const finish = async (withGoals: boolean) => {
    setErr("");
    try {
      const s = withGoals ? fromVals(g.vals, true) : { ...(settings ?? fromVals(g.vals, true)), onboarded: true };
      const saved = await put<Settings>("/me/settings", s);
      qc.setQueryData(qk.settings, saved);
    } catch (e) { setErr((e as Error).message); }
  };

  return (
    <div className="wrap auth">
      <div className="card" style={{ maxWidth: 560 }}>
        <span className="label">Step {step} of 2</span>
        {step === 1 ? (
          <>
            <h1>Welcome, {username}</h1>
            <p className="muted">Set your targets so Iron Log can draw your target line and flag days you miss. Leave anything blank; you can change it later in Account.</p>
            <GoalsFields g={g} />
            {err && <p className="err">{err}</p>}
            <div className="row between">
              <button type="button" className="btn ghost" onClick={() => setStep(2)}>Skip</button>
              <button type="button" className="btn primary" onClick={async () => {
                try { qc.setQueryData(qk.settings, await put<Settings>("/me/settings", fromVals(g.vals, false))); setStep(2); }
                catch (e) { setErr((e as Error).message); }
              }}>Next</button>
            </div>
          </>
        ) : (
          <>
            <h1>Pick a program</h1>
            <p className="muted">Start from a proven split and edit it later, or build your own routines from 870+ exercises.</p>
            {routines.length > 0 && <p className="pill good">{routines.length} routines ready</p>}
            <button type="button" className="btn primary" onClick={() => setTemplates(true)}>Choose a template</button>
            {err && <p className="err">{err}</p>}
            <div className="row between">
              <button type="button" className="btn ghost" onClick={() => setStep(1)}>Back</button>
              <button type="button" className="btn" onClick={() => finish(false)}>{routines.length ? "Start training" : "I'll build my own"}</button>
            </div>
          </>
        )}
      </div>
      {templates && <TemplatesSheet hasRoutines={routines.length > 0} onClose={() => setTemplates(false)} onApplied={() => void finish(false)} />}
    </div>
  );
}
