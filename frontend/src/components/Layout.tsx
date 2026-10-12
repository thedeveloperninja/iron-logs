import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import type { User } from "@/api/types";
import { flushQueue, queueSize } from "@/hooks/useAutosave";

const TABS: { to: string; label: string; icon: ReactNode }[] = [
  { to: "/", label: "Workout", icon: <path d="M6 7v10M18 7v10M3 9v6M21 9v6M6 12h12" /> },
  { to: "/body", label: "Body", icon: <path d="M4 20h16M7 20V10m5 10V5m5 15v-7" /> },
  { to: "/progress", label: "Progress", icon: <path d="M3 17l5-5 4 3 8-8M15 7h5v5" /> },
  { to: "/history", label: "History", icon: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></> },
  { to: "/routines", label: "Routines", icon: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" /> },
];

function SyncBadge() {
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(queueSize());
  useEffect(() => {
    const up = () => { setOnline(navigator.onLine); setPending(queueSize()); };
    window.addEventListener("online", up); window.addEventListener("offline", up);
    const iv = window.setInterval(up, 2000);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", up); window.clearInterval(iv); };
  }, []);
  const cls = !online ? "off" : pending ? "busy" : "ok";
  const txt = !online ? `Offline${pending ? ` · ${pending} to sync` : ""}` : pending ? `${pending} to sync` : "Synced";
  return (
    <button type="button" className="sync" style={{ background: "none", border: 0 }} onClick={() => void flushQueue()}
      title="Changes are saved on this phone first and sent to the server when online">
      <i className={`dot ${cls}`} />{txt}
    </button>
  );
}

export function Layout({ user, children }: { user: User; children: ReactNode }) {
  return (
    <>
      <header className="topbar"><div className="wrap">
        <Link to="/" className="brand">Iron Log</Link>
        <div className="grow" />
        <SyncBadge />
        <Link to="/account" className="acct" aria-label="Account, settings and data">{user.username}</Link>
      </div></header>
      <main className="wrap app-main">{children}</main>
      <nav className="tabs" aria-label="Sections"><div className="wrap">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to === "/"} className={({ isActive }) => (isActive ? "active" : "")}>
            <svg viewBox="0 0 24 24" aria-hidden="true">{t.icon}</svg>{t.label}
          </NavLink>
        ))}
      </div></nav>
    </>
  );
}
