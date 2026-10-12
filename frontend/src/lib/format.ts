export const f1 = (n: number | null | undefined) =>
  n == null || Number.isNaN(n) ? "–" : (Math.round(n * 10) / 10).toLocaleString(undefined, { maximumFractionDigits: 1 });
export const f0 = (n: number | null | undefined) =>
  n == null || Number.isNaN(n) ? "–" : Math.round(n).toLocaleString();
export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, "0")}`;

/** Parse a user-typed number ("62,5" works too). Empty -> null. */
export const toNum = (v: string): number | null => {
  const t = v.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};
export const toInt = (v: string): number | null => { const n = toNum(v); return n == null ? null : Math.round(n); };
export const title = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
