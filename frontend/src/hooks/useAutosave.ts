import { useCallback, useEffect, useRef, useState } from "react";

export type SaveState = "idle" | "pending" | "saving" | "saved" | "offline" | "error";

const QUEUE_KEY = "ironlog:queue";

type Queue = Record<string, { method: "PUT" | "DELETE"; body?: unknown; at: number }>;

function readQueue(): Queue {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || "{}"); } catch { return {}; }
}
function writeQueue(q: Queue) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch { /* storage full or blocked */ }
}

/** Latest unsent payload for a path (used to restore edits made offline). */
export function queued<T>(path: string): T | undefined {
  const e = readQueue()[path];
  return e && e.method === "PUT" ? (e.body as T) : undefined;
}
export const queueSize = () => Object.keys(readQueue()).length;

async function send(path: string, method: "PUT" | "DELETE", body?: unknown) {
  const res = await fetch("/api/v1" + path, {
    method, credentials: "same-origin",
    headers: { "X-Requested-With": "IronLog", "Content-Type": "application/json" },
    body: method === "PUT" ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try { const j = await res.json(); if (typeof j.detail === "string") msg = j.detail; } catch { /* ignore */ }
    const err = new Error(msg) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

const listeners = new Set<() => void>();
let flushing = false;

/** Send everything in the offline queue, oldest first. Network errors keep items queued. */
export async function flushQueue(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    const q = readQueue();
    for (const [path, e] of Object.entries(q).sort((a, b) => a[1].at - b[1].at)) {
      try {
        await send(path, e.method, e.body);
        const cur = readQueue();
        if (cur[path]?.at === e.at) { delete cur[path]; writeQueue(cur); }
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status && status >= 400 && status < 500 && status !== 401 && status !== 429) {
          const cur = readQueue(); delete cur[path]; writeQueue(cur); // invalid payload: drop it
        } else break; // offline / server down: try later
      }
    }
  } finally {
    flushing = false;
    listeners.forEach((l) => l());
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => void flushQueue());
  setInterval(() => { if (queueSize()) void flushQueue(); }, 20_000);
}

/**
 * Debounced, offline-tolerant save for one resource path.
 * Every change is written to a local queue first, so nothing is lost if the
 * phone drops signal mid-workout; the queue is replayed when back online.
 */
export function useAutosave<T>(path: string, delay = 700, onSaved?: (result: unknown) => void) {
  const [state, setState] = useState<SaveState>("idle");
  const timer = useRef<number>();
  const savedCb = useRef(onSaved);
  savedCb.current = onSaved;

  const run = useCallback(async () => {
    const entry = readQueue()[path];
    if (!entry) return;
    setState("saving");
    try {
      const result = await send(path, entry.method, entry.body);
      const cur = readQueue();
      if (cur[path]?.at === entry.at) { delete cur[path]; writeQueue(cur); setState("saved"); savedCb.current?.(result); }
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (!status || status >= 500 || status === 429) setState("offline");
      else { const cur = readQueue(); delete cur[path]; writeQueue(cur); setState("error"); throw err; }
    }
  }, [path]);

  const save = useCallback((body: T) => {
    const q = readQueue();
    q[path] = { method: "PUT", body, at: Date.now() };
    writeQueue(q);
    setState("pending");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { run().catch(() => undefined); }, delay);
  }, [path, delay, run]);

  const remove = useCallback(async () => {
    window.clearTimeout(timer.current);
    const q = readQueue();
    q[path] = { method: "DELETE", at: Date.now() };
    writeQueue(q);
    await run();
  }, [path, run]);

  // flush pending edits when leaving the page or switching path
  useEffect(() => () => { window.clearTimeout(timer.current); void flushQueue(); }, [path]);
  useEffect(() => {
    const l = () => setState((s) => (s === "offline" && !readQueue()[path] ? "saved" : s));
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, [path]);

  return { save, remove, state };
}
