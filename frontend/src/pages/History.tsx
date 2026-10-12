import { Link } from "react-router-dom";
import { useWorkouts } from "@/api/queries";
import { fmtDay } from "@/lib/date";
import { f0 } from "@/lib/format";

export default function HistoryPage() {
  const { data, isLoading } = useWorkouts();
  const list = (data ?? []).filter((w) => w.setsDone > 0);
  const sets = list.reduce((a, w) => a + w.setsDone, 0);
  const vol = list.reduce((a, w) => a + w.volumeKg, 0);
  const prs = list.reduce((a, w) => a + w.prCount, 0);
  return (
    <>
      <h1>History</h1>
      {isLoading ? <div className="empty">Loading…</div> : !list.length ? (
        <div className="card empty">No workouts yet. Tick off sets on the Workout tab and they show up here.</div>
      ) : (
        <>
          <div className="tiles">
            <div className="tile"><span className="label">Workouts</span><b>{list.length}</b></div>
            <div className="tile"><span className="label">Sets</span><b>{f0(sets)}</b></div>
            <div className="tile"><span className="label">Volume</span><b>{(vol / 1000).toFixed(1)}t</b><small>{prs} PRs</small></div>
          </div>
          <div className="stack">
            {list.map((w) => (
              <Link key={w.date} to={`/?d=${w.date}`} className="listbtn">
                <span className={`sw ${w.color}`} />
                <span className="grow">
                  <b style={{ fontFamily: "var(--f-display)", fontSize: 18 }}>{w.name}</b><br />
                  <span className="muted">{fmtDay(w.date)} · {w.setsDone}/{w.setsTotal} sets · {f0(w.volumeKg)} kg</span>
                </span>
                {w.prCount > 0 && <span className="pill pr">{w.prCount} PR</span>}
                {!w.finished && <span className="pill alt">Open</span>}
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}
