import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, post, put } from "@/api/client";
import { qk, useMe } from "@/api/queries";
import type { AdminOverview, Invite, SignupMode } from "@/api/types";
import { ConfirmButton } from "@/components/Sheet";
import { useToast } from "@/hooks/useToast";
import { fmtDateTime } from "@/lib/date";

function Copy({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className="btn small" onClick={() => {
      navigator.clipboard?.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); }).catch(() => undefined);
    }}>{ok ? "Copied" : "Copy"}</button>
  );
}

export default function AdminPage() {
  const me = useMe().data!;
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: qk.admin, queryFn: () => get<AdminOverview>("/admin") });
  const refresh = () => qc.invalidateQueries({ queryKey: qk.admin });
  const onError = (e: Error) => toast(e.message);
  const [days, setDays] = useState("7");
  const [note, setNote] = useState("");
  const [newCode, setNewCode] = useState<string | null>(null);
  const [temp, setTemp] = useState<{ user: string; pw: string } | null>(null);

  const signup = useMutation({ mutationFn: (mode: SignupMode) => put("/admin/signup", { mode }), onSuccess: () => { void refresh(); void qc.invalidateQueries({ queryKey: qk.config }); }, onError });
  const invite = useMutation({
    mutationFn: () => post<Invite>("/admin/invites", { days: Math.min(90, Math.max(1, parseInt(days) || 7)), note: note.trim() || null }),
    onSuccess: (i) => { setNewCode(i.code); setNote(""); void refresh(); }, onError,
  });

  if (!me.isAdmin) return <div className="card empty">Admins only.</div>;
  if (q.isLoading || !q.data) return <div className="empty">Loading…</div>;
  const d = q.data;
  const link = `${location.origin}/`;

  return (
    <>
      <div className="row"><Link to="/account" className="btn small ghost">‹ Account</Link><h1>Admin</h1></div>

      <section className="card stack">
        <h3>Who can sign up</h3>
        <div className="chips">
          {(["invite", "open", "closed"] as SignupMode[]).map((m) => (
            <button key={m} type="button" className="chip" aria-pressed={d.signup === m} onClick={() => signup.mutate(m)}>
              {{ invite: "Invite code", open: "Anyone", closed: "Nobody" }[m]}</button>
          ))}
        </div>
        <p className="hint">{{ invite: "People need an invite code from you. Recommended for friends.", open: "Anyone who can reach this server can create an account.", closed: "Only existing users can sign in." }[d.signup]}</p>
      </section>

      <section className="card stack">
        <h3>Invite a friend</h3>
        <div className="row" style={{ alignItems: "flex-end" }}>
          <label className="field grow"><span className="label">Note (who it's for)</span><input value={note} maxLength={80} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Arjun" /></label>
          <label className="field" style={{ width: 100 }}><span className="label">Valid days</span><input inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} /></label>
          <button type="button" className="btn primary" onClick={() => invite.mutate()} disabled={invite.isPending}>Create code</button>
        </div>
        {newCode && (
          <div className="stack" style={{ gap: 6 }}>
            <div className="row"><span className="code">{newCode}</span><Copy text={newCode} /></div>
            <p className="hint">Send them the code and this address: <b>{link}</b>. Each code works once.</p>
            <Copy text={`Join me on Iron Log: ${link}\nInvite code: ${newCode}`} />
          </div>
        )}
        {d.invites.length > 0 && (
          <div className="tablewrap"><table className="data">
            <thead><tr><th>Code</th><th>Note</th><th>Status</th><th>Expires</th><th></th></tr></thead>
            <tbody>{d.invites.map((i) => (
              <tr key={i.code}><td>{i.code}</td><td className="txt">{i.note ?? ""}</td>
                <td className="txt">{i.usedBy ? `Used by ${i.usedBy}` : "Unused"}</td><td>{fmtDateTime(i.expiresAt)}</td>
                <td>{!i.usedBy && <button type="button" className="btn small ghost danger" onClick={() => del(`/admin/invites/${i.code}`).then(refresh).catch(onError)}>Revoke</button>}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      <section className="card stack">
        <h3>Users ({d.users.length})</h3>
        {temp && (
          <div className="card stack" style={{ background: "var(--sunk)" }}>
            <p>Temporary password for <b>{temp.user}</b> (shown once; ask them to change it in Account):</p>
            <div className="row"><span className="code">{temp.pw}</span><Copy text={temp.pw} /></div>
          </div>
        )}
        <div className="stack">
          {d.users.map((u) => (
            <div key={u.id} className="listbtn" style={{ flexWrap: "wrap" }}>
              <span className="grow">
                <b>{u.username}</b> {u.isAdmin && <span className="pill good">Admin</span>} {u.id === me.id && <span className="pill alt">You</span>}<br />
                <span className="hint">{u.workouts} workouts · joined {fmtDateTime(u.createdAt)} · last seen {fmtDateTime(u.lastSeenAt)}</span>
              </span>
              {u.id !== me.id && (
                <div className="row">
                  <button type="button" className="btn small" onClick={() => post<{ tempPassword: string }>(`/admin/users/${u.id}/reset-password`)
                    .then((r) => setTemp({ user: u.username, pw: r.tempPassword })).catch(onError)}>Reset password</button>
                  <button type="button" className="btn small" onClick={() => put(`/admin/users/${u.id}/admin`, { isAdmin: !u.isAdmin }).then(refresh).catch(onError)}>
                    {u.isAdmin ? "Remove admin" : "Make admin"}</button>
                  <ConfirmButton label="Delete" confirmLabel="Delete" question={`Delete ${u.username} and all their data?`} className="btn small danger"
                    onConfirm={() => del(`/admin/users/${u.id}`).then(refresh).catch(onError)} />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
