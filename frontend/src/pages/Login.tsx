import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { post } from "@/api/client";
import { resetSession, useConfig } from "@/api/queries";
import type { User } from "@/api/types";

export default function LoginPage() {
  const qc = useQueryClient();
  const cfg = useConfig().data;
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [invite, setInvite] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const register = mode === "register" || !!cfg?.firstUser;
  const canRegister = cfg?.signup !== "closed";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const user = await post<User>(register ? "/auth/register" : "/auth/login",
        register ? { username: username.trim(), password, invite: invite.trim() || null } : { username: username.trim(), password });
      resetSession(qc, user);
    } catch (ex) {
      setErr((ex as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <div className="wrap auth">
      <form className="card" onSubmit={submit}>
        <div>
          <h1>Iron Log</h1>
          <p className="muted">{cfg?.firstUser ? "Set up the first account. You'll be the admin of this server." : register ? "Create your account." : "Sign in to log your training."}</p>
        </div>
        <label className="field"><span className="label">Username</span>
          <input autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={register ? 3 : 1} maxLength={32}
            pattern={register ? "[A-Za-z0-9_.\\-]+" : undefined} autoCapitalize="none" autoCorrect="off" /></label>
        <label className="field"><span className="label">Password</span>
          <input type="password" autoComplete={register ? "new-password" : "current-password"} value={password}
            onChange={(e) => setPassword(e.target.value)} required minLength={register ? 8 : 1} /></label>
        {register && !cfg?.firstUser && cfg?.signup === "invite" && (
          <label className="field"><span className="label">Invite code</span>
            <input value={invite} onChange={(e) => setInvite(e.target.value.toUpperCase())} placeholder="ABCD-EFGH" required autoCapitalize="characters" /></label>
        )}
        {register && <p className="hint">Username: letters, numbers, dot, dash or underscore. Password: at least 8 characters.</p>}
        {err && <p className="err" role="alert">{err}</p>}
        <button type="submit" className="btn primary" disabled={busy}>{busy ? "Please wait…" : register ? "Create account" : "Sign in"}</button>
        {!cfg?.firstUser && canRegister && (
          <p className="muted" style={{ textAlign: "center" }}>
            {register ? "Already have an account? " : "New here? "}
            <button type="button" className="linkbtn" onClick={() => { setMode(register ? "login" : "register"); setErr(""); }}>
              {register ? "Sign in" : "Create an account"}
            </button>
          </p>
        )}
        {!cfg?.firstUser && !canRegister && <p className="hint" style={{ textAlign: "center" }}>New accounts are created by the server admin.</p>}
      </form>
    </div>
  );
}
