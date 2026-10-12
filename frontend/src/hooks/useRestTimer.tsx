import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { mmss } from "@/lib/format";

interface Timer { start: (seconds: number, label: string) => void; stop: () => void; }
const Ctx = createContext<Timer>({ start: () => undefined, stop: () => undefined });
export const useRestTimer = () => useContext(Ctx);

function beep() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    [0, 0.25].forEach((t) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.15, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.2);
    });
  } catch { /* audio not allowed */ }
  try { navigator.vibrate?.([200, 100, 200]); } catch { /* ignore */ }
}

export function RestTimerProvider({ children }: { children: ReactNode }) {
  const [end, setEnd] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [label, setLabel] = useState("");
  const [, tick] = useState(0);
  const iv = useRef<number>();

  const stop = useCallback(() => setEnd(null), []);
  const start = useCallback((seconds: number, l: string) => {
    if (seconds <= 0) return;
    setTotal(seconds); setLabel(l); setEnd(Date.now() + seconds * 1000);
  }, []);

  useEffect(() => {
    window.clearInterval(iv.current);
    if (end == null) return;
    iv.current = window.setInterval(() => {
      if (Date.now() >= end) { beep(); setEnd(null); } else tick((n) => n + 1);
    }, 250);
    return () => window.clearInterval(iv.current);
  }, [end]);

  useEffect(() => {
    document.body.classList.toggle("timer-on", end != null);
  }, [end]);

  const left = end == null ? 0 : Math.max(0, Math.round((end - Date.now()) / 1000));
  return (
    <Ctx.Provider value={{ start, stop }}>
      {children}
      {end != null && (
        <div className="timer" role="timer" aria-live="off">
          <div className="wrap"><div className="box">
            <div className="clock">{mmss(left)}</div>
            <div className="grow">
              <div className="lbl">Next: {label}</div>
              <div className="track"><i style={{ width: `${total ? (100 * left) / total : 0}%` }} /></div>
            </div>
            <button type="button" onClick={() => setEnd((e) => (e ? e - 15000 : e))}>−15</button>
            <button type="button" onClick={() => { setEnd((e) => (e ? e + 30000 : e)); setTotal((t) => t + 30); }}>+30</button>
            <button type="button" onClick={stop}>Skip</button>
          </div></div>
        </div>
      )}
    </Ctx.Provider>
  );
}
