import type { Color } from "@/api/types";
import { DOW, addDays, fmtDay, parse, today, weekStart } from "@/lib/date";

export interface DayInfo { label: string; color: Color | "rest"; done?: boolean; }

export function DateNav({ date, onChange, info }: { date: string; onChange: (d: string) => void; info?: (d: string) => DayInfo }) {
  const t = today();
  const ws = weekStart(date);
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="datenav">
        <button type="button" className="iconbtn" onClick={() => onChange(addDays(date, -1))} aria-label="Previous day">‹</button>
        <div className="when">
          <span className="label">{date === t ? "Today" : date < t ? "Past day" : "Upcoming"}</span>
          <b>{fmtDay(date)}</b>
        </div>
        <button type="button" className="iconbtn" onClick={() => onChange(addDays(date, 1))} aria-label="Next day">›</button>
        {date !== t && <button type="button" className="btn small" onClick={() => onChange(t)}>Today</button>}
      </div>
      {info && (
        <div className="week">
          {Array.from({ length: 7 }, (_, i) => {
            const d = addDays(ws, i);
            const inf = info(d);
            return (
              <button key={d} type="button" className={`wday${d === date ? " sel" : ""}${d === t ? " today" : ""}`}
                onClick={() => onChange(d)} aria-label={`${fmtDay(d)}: ${inf.label}`} aria-current={d === date ? "date" : undefined}>
                {inf.done && <span className="tick" />}
                {DOW[i]}<b>{parse(d).getDate()}</b><i className={`c-${inf.color}`}>{inf.label}</i>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
