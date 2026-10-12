import { useEffect, useState } from "react";
import type { Exercise } from "@/api/types";
import { useConfig } from "@/api/queries";
import { title } from "@/lib/format";

export function useImageUrl() {
  const base = useConfig().data?.exerciseImageBase ?? "";
  return (path: string) => (/^https?:\/\//.test(path) || path.startsWith("/") ? path : base + path);
}

/** Start/end photos played as a loop, so each exercise animates like a GIF. */
export function DemoLoop({ exercise, interval = 900 }: { exercise: Exercise; interval?: number }) {
  const url = useImageUrl();
  const [i, setI] = useState(0);
  const [failed, setFailed] = useState(false);
  const imgs = exercise.images;
  useEffect(() => {
    setI(0); setFailed(false);
    if (imgs.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => setI((n) => (n + 1) % imgs.length), interval);
    return () => window.clearInterval(t);
  }, [exercise.id, imgs.length, interval]);
  if (!imgs.length || failed) {
    return <div className="demo" style={{ display: "grid", placeItems: "center" }}><span className="muted">No demo image</span></div>;
  }
  return (
    <div className="demo">
      {/* preload both frames */}
      {imgs.map((p, n) => (
        <img key={p} src={url(p)} alt={n === 0 ? `${exercise.name}: start position` : `${exercise.name}: end position`}
          style={{ display: n === i ? "block" : "none" }} onError={() => setFailed(true)} loading="lazy" />
      ))}
      <span className="badge">{i === 0 ? "Start" : "Finish"}</span>
    </div>
  );
}

export function Thumb({ exercise }: { exercise: Pick<Exercise, "images" | "name"> }) {
  const url = useImageUrl();
  if (!exercise.images?.length) return <span className="thumb" aria-hidden="true" />;
  return <img className="thumb" src={url(exercise.images[0])} alt="" loading="lazy" />;
}

export function ExerciseDetail({ exercise }: { exercise: Exercise }) {
  const facts = [
    exercise.equipment && ["Equipment", title(exercise.equipment)],
    exercise.level && ["Level", title(exercise.level)],
    exercise.mechanic && ["Type", title(exercise.mechanic)],
  ].filter(Boolean) as [string, string][];
  return (
    <div className="stack">
      <DemoLoop exercise={exercise} />
      <div className="row">
        {exercise.primaryMuscles.map((m) => <span key={m} className="pill good">{m}</span>)}
        {exercise.secondaryMuscles.map((m) => <span key={m} className="pill alt">{m}</span>)}
      </div>
      {facts.length > 0 && (
        <div className="row" style={{ gap: 16 }}>
          {facts.map(([k, v]) => <div key={k}><div className="label">{k}</div><div>{v}</div></div>)}
        </div>
      )}
      {exercise.instructions.length > 0 ? (
        <div className="stack" style={{ gap: 6 }}>
          <h3>How to do it</h3>
          <ol className="steps">{exercise.instructions.map((s, n) => <li key={n}>{s}</li>)}</ol>
        </div>
      ) : <p className="muted">No instructions for this exercise yet.</p>}
      {!exercise.custom && <p className="hint">Images and instructions: free-exercise-db (public domain).</p>}
    </div>
  );
}
