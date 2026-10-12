export interface Series { points: { x: number; y: number }[]; color: string; width?: number; dashed?: boolean; dots?: boolean; label?: string; }

/** Small dependency-free SVG line chart. x and y are numbers; ticks are supplied by the caller. */
export function LineChart({ series, xTicks = [], x0, x1, label, height = 230 }: {
  series: Series[]; xTicks?: { x: number; label: string }[]; x0?: number; x1?: number; label: string; height?: number;
}) {
  const W = 640, H = height, L = 42, R = 12, T = 12, B = 28;
  const pts = series.flatMap((s) => s.points);
  if (!pts.length) return <div className="empty">No data yet</div>;
  let lo = x0 ?? Math.min(...pts.map((p) => p.x));
  let hi = x1 ?? Math.max(...pts.map((p) => p.x));
  if (hi === lo) { hi = lo + 1; }
  let y0 = Math.min(...pts.map((p) => p.y)), y1 = Math.max(...pts.map((p) => p.y));
  const pad = Math.max((y1 - y0) * 0.12, 1);
  y0 = Math.floor(y0 - pad); y1 = Math.ceil(y1 + pad);
  const X = (x: number) => L + ((x - lo) / (hi - lo)) * (W - L - R);
  const Y = (y: number) => T + (1 - (y - y0) / (y1 - y0)) * (H - T - B);
  const step = Math.max(1, Math.ceil((y1 - y0) / 5));
  const grid: number[] = [];
  for (let v = Math.ceil(y0 / step) * step; v <= y1; v += step) grid.push(v);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {grid.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="var(--line)" />
          <text x={L - 6} y={Y(v) + 4} textAnchor="end">{v}</text>
        </g>
      ))}
      {xTicks.filter((t) => t.x >= lo && t.x <= hi).map((t) => (
        <text key={t.x} x={X(t.x)} y={H - 8} textAnchor="middle">{t.label}</text>
      ))}
      {series.map((s, i) => s.points.length > 0 && (
        <g key={i}>
          {(s.width ?? 2) > 0 && (
            <path d={s.points.map((p, n) => `${n ? "L" : "M"}${X(p.x).toFixed(1)} ${Y(p.y).toFixed(1)}`).join(" ")}
              fill="none" stroke={s.color} strokeWidth={s.width ?? 2} strokeDasharray={s.dashed ? "5 5" : undefined}
              strokeLinejoin="round" strokeLinecap="round" />
          )}
          {s.dots && s.points.map((p, n) => (
            <circle key={n} cx={X(p.x)} cy={Y(p.y)} r={n === s.points.length - 1 ? 4.5 : 2.5} fill={s.color} />
          ))}
        </g>
      ))}
    </svg>
  );
}
