// Calendar dates are plain "YYYY-MM-DD" strings in the user's local time.
const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const today = () => ymd(new Date());
export const addDays = (s: string, n: number) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
export const diffDays = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000);
/** 0 = Monday ... 6 = Sunday (matches the backend schedule). */
export const weekday = (s: string) => (parse(s).getDay() + 6) % 7;
export const weekStart = (s: string) => addDays(s, -weekday(s));
export const isValid = (s: string | null | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const fmtDay = (s: string) => { const d = parse(s); return `${DOW[weekday(s)]} ${d.getDate()} ${MON[d.getMonth()]}`; };
export const fmtShort = (s: string) => { const d = parse(s); return `${d.getDate()} ${MON[d.getMonth()]}`; };
export const fmtDateTime = (iso: string | null) => iso ? new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "–";
