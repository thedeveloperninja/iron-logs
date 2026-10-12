import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { download, post } from "@/api/client";
import { resetSession, useConfig, useMe, useSaveSettings, useSettings } from "@/api/queries";
import type { ImportResult, Settings } from "@/api/types";
import { GoalsFields, fromVals, useGoals } from "@/components/GoalsForm";
import { ConfirmButton } from "@/components/Sheet";
import { useToast } from "@/hooks/useToast";
import { THEME_KEY, applyTheme } from "@/lib/theme";


export default function AccountPage() {
  const me = useMe().data!;
  const cfg = useConfig().data;
  const settings = useSettings();
  return (
    <>
      <div className="row between"><h1>Account</h1>{me.isAdmin && <Link to="/admin" className="btn small">Admin</Link>}</div>
      {settings.data && <Goals initial={settings.data} />}
      <Appearance />
      <DataTransfer />
      <Password />
      <Danger />
      <p className="hint" style={{ textAlign: "center" }}>Iron Log {cfg?.version} · signed in as {me.username}</p>
    </>
  );
}

function Goals({ initial }: { initial: Settings }) {
  const g = useGoals(initial);
  const save = useSaveSettings();
  const toast = useToast();
  return (
    <section className="card stack">
      <h3>Goals & targets</h3>
      <GoalsFields g={g} />
      <button type="button" className="btn primary" disabled={save.isPending}
        onClick={() => save.mutate(fromVals(g.vals, true), { onSuccess: () => toast("Targets saved."), onError: (e) => toast(e.message) })}>
        Save targets</button>
    </section>
  );
}

function Appearance() {
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem(THEME_KEY) || ""; } catch { return ""; } });
  const pick = (t: string) => { setTheme(t); applyTheme(t); try { localStorage.setItem(THEME_KEY, t); } catch { /* ignore */ } };
  return (
    <section className="card stack">
      <h3>Appearance</h3>
      <div className="chips">
        {[["", "System"], ["light", "Light"], ["dark", "Dark"]].map(([v, l]) => (
          <button key={v} type="button" className="chip" aria-pressed={theme === v} onClick={() => pick(v)}>{l}</button>
        ))}
      </div>
      <p className="hint">Add Iron Log to your home screen: in Chrome use ⋮ → Install app; in Safari use Share → Add to Home Screen.</p>
    </section>
  );
}

function DataTransfer() {
  const qc = useQueryClient();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [pending, setPending] = useState<{ name: string; data: unknown } | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try { setPending({ name: f.name, data: JSON.parse(await f.text()) }); setResult(null); }
    catch { toast("That file isn't valid JSON."); }
    if (fileRef.current) fileRef.current.value = "";
  };
  const runImport = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const r = await post<ImportResult>(`/import?mode=${mode}`, pending.data);
      setResult(r); setPending(null);
      await qc.invalidateQueries();
      toast("Import complete.");
    } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <section className="card stack">
      <h3>Your data</h3>
      <p className="hint">Export everything (workouts, routines, body logs, targets, custom exercises) as JSON. Import it here or on another Iron Log server.</p>
      <div className="row">
        <button type="button" className="btn" onClick={() => download("/export", "iron-log-export.json").catch((e: Error) => toast(e.message))}>Export JSON</button>
        <button type="button" className="btn" onClick={() => fileRef.current?.click()}>Import JSON…</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
      {pending && (
        <div className="card stack" style={{ background: "var(--sunk)" }}>
          <p>Ready to import <b>{pending.name}</b></p>
          <div className="chips">
            <button type="button" className="chip" aria-pressed={mode === "merge"} onClick={() => setMode("merge")}>Merge</button>
            <button type="button" className="chip" aria-pressed={mode === "replace"} onClick={() => setMode("replace")}>Replace all</button>
          </div>
          <p className="hint">{mode === "merge" ? "Adds the file's data. Days that exist in both are overwritten by the file." : "Deletes your current workouts, routines and body logs first, then imports the file."}</p>
          <div className="row">
            {mode === "replace"
              ? <ConfirmButton label="Import and replace" confirmLabel="Replace" question="Delete current data and import?" className="btn primary" disabled={busy} onConfirm={runImport} />
              : <button type="button" className="btn primary" disabled={busy} onClick={runImport}>Import</button>}
            <button type="button" className="btn ghost" onClick={() => setPending(null)}>Cancel</button>
          </div>
        </div>
      )}
      {result && (
        <p className="hint">Imported {result.workouts} workouts, {result.bodyLogs} body logs, {result.routines} routines, {result.customExercises} custom exercises.
          {result.skipped.length > 0 && <> Skipped: {result.skipped.join("; ")}</>}</p>
      )}
    </section>
  );
}

function Password() {
  const toast = useToast();
  const [cur, setCur] = useState("");
  const [nw, setNw] = useState("");
  const [err, setErr] = useState("");
  return (
    <form className="card stack" onSubmit={async (e) => {
      e.preventDefault(); setErr("");
      try { await post("/auth/password", { current: cur, new: nw }); setCur(""); setNw(""); toast("Password changed. Other devices were signed out."); }
      catch (ex) { setErr((ex as Error).message); }
    }}>
      <h3>Change password</h3>
      <div className="grid2">
        <label className="field"><span className="label">Current</span><input type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} required /></label>
        <label className="field"><span className="label">New (8+ characters)</span><input type="password" autoComplete="new-password" minLength={8} value={nw} onChange={(e) => setNw(e.target.value)} required /></label>
      </div>
      {err && <p className="err">{err}</p>}
      <button type="submit" className="btn">Change password</button>
    </form>
  );
}

function Danger() {
  const qc = useQueryClient();
  const toast = useToast();
  const [pw, setPw] = useState("");
  const signOut = async () => {
    try { await post("/auth/logout"); } catch { /* ignore */ }
    try { localStorage.removeItem("ironlog:queue"); } catch { /* ignore */ }
    resetSession(qc, null);
  };
  return (
    <section className="card stack">
      <h3>Session</h3>
      <button type="button" className="btn" onClick={signOut}>Sign out</button>
      <details>
        <summary className="hint" style={{ cursor: "pointer" }}>Delete my account</summary>
        <div className="stack" style={{ marginTop: 10 }}>
          <p className="hint">This permanently deletes your account and all your data. Export first if you want a copy.</p>
          <label className="field"><span className="label">Password</span><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" /></label>
          <ConfirmButton label="Delete account" confirmLabel="Delete forever" question="Delete your account and all data?" disabled={!pw}
            onConfirm={async () => {
              try { await post("/auth/delete-account", { password: pw }); resetSession(qc, null); }
              catch (e) { toast((e as Error).message); }
            }} />
        </div>
      </details>
    </section>
  );
}
