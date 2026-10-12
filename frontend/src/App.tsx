import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { setUnauthorizedHandler } from "@/api/client";
import { resetSession, useMe, useSettings } from "@/api/queries";
import { Layout } from "@/components/Layout";
import { flushQueue } from "@/hooks/useAutosave";
import LoginPage from "@/pages/Login";
import Onboarding from "@/pages/Onboarding";
import WorkoutPage from "@/pages/Workout";

const BodyPage = lazy(() => import("@/pages/Body"));
const ProgressPage = lazy(() => import("@/pages/Progress"));
const HistoryPage = lazy(() => import("@/pages/History"));
const RoutinesPage = lazy(() => import("@/pages/Routines"));
const RoutineEditor = lazy(() => import("@/pages/RoutineEditor"));
const ExercisesPage = lazy(() => import("@/pages/Exercises"));
const AccountPage = lazy(() => import("@/pages/Account"));
const AdminPage = lazy(() => import("@/pages/Admin"));

export default function App() {
  const qc = useQueryClient();
  const me = useMe();
  useEffect(() => { setUnauthorizedHandler(() => resetSession(qc, null)); }, [qc]);
  useEffect(() => { if (me.data) void flushQueue(); }, [me.data]);

  if (me.isLoading) return <div className="wrap empty">Loading…</div>;
  if (me.isError) return <div className="wrap auth"><div className="card"><h2>Can't reach the server</h2><p className="muted">{(me.error as Error).message}</p><button type="button" className="btn primary" onClick={() => me.refetch()}>Try again</button></div></div>;
  if (!me.data) return <LoginPage />;
  return <Authed username={me.data.username} user={me.data} />;
}

function Authed({ user, username }: { user: NonNullable<ReturnType<typeof useMe>["data"]>; username: string }) {
  const settings = useSettings();
  if (settings.isLoading) return <div className="wrap empty">Loading…</div>;
  if (settings.data && !settings.data.onboarded) return <Onboarding username={username} />;
  return (
    <Layout user={user}>
      <Suspense fallback={<div className="empty">Loading…</div>}>
        <Routes>
          <Route path="/" element={<WorkoutPage />} />
          <Route path="/body" element={<BodyPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/routines" element={<RoutinesPage />} />
          <Route path="/routines/:id" element={<RoutineEditor />} />
          <Route path="/exercises" element={<ExercisesPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}
