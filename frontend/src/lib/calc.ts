import type { BodyLog, Kind, SetIO, Settings } from "@/api/types";
import { addDays, diffDays } from "./date";

/** Epley estimated one-rep max (same formula as the backend). */
export const e1rm = (kg: number, reps: number) => (reps > 1 ? kg * (1 + reps / 30) : kg);

export function setStats(kind: Kind, sets: SetIO[]) {
  let done = 0, volume = 0, best = 0;
  let top: number | null = null;
  for (const s of sets) {
    if (!s.done) continue;
    done++;
    if (kind === "weight" && s.weightKg != null && s.reps) {
      volume += s.weightKg * s.reps;
      best = Math.max(best, e1rm(s.weightKg, s.reps));
    }
    if (s.weightKg != null) top = top == null ? s.weightKg : kind === "assist" ? Math.min(top, s.weightKg) : Math.max(top, s.weightKg);
  }
  return { done, volume, best, top };
}

/** Straight-line target weight between start and goal across the plan dates. */
export function targetWeight(s: Settings | undefined, date: string): number | null {
  if (!s?.startDate || !s.endDate || s.startWeightKg == null || s.goalWeightKg == null) return null;
  const span = diffDays(s.startDate, s.endDate);
  if (span <= 0) return s.goalWeightKg;
  const k = Math.min(Math.max(diffDays(s.startDate, date), 0), span);
  return s.startWeightKg - (s.startWeightKg - s.goalWeightKg) * (k / span);
}

/** Average of the weigh-ins in the 7 days ending on `date`. */
export function avg7(byDate: Map<string, BodyLog>, date: string): number | null {
  const v: number[] = [];
  for (let i = 0; i < 7; i++) {
    const w = byDate.get(addDays(date, -i))?.weightKg;
    if (w != null) v.push(w);
  }
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export const defaultReps = (target: string) => {
  const m = /\d+/.exec(target);
  return m ? Number(m[0]) : null;
};
