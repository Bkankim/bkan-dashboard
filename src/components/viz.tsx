// 실데이터 부품. 흰 바탕·검은 선만, 색 대신 빗금·점선으로 구분한다.
import type { ReactNode } from "react";

export const fmt = {
  n: (v: number | null | undefined) => (v == null || Number.isNaN(v) ? "-" : Math.round(v).toLocaleString("ko-KR")),
  pct: (v: number | null | undefined, digits = 1) => (v == null || Number.isNaN(v) ? "-" : `${(v * 100).toFixed(digits)}%`),
  bytes: (v: number | null | undefined) => {
    if (v == null) return "-";
    const u = ["B", "KB", "MB", "GB", "TB"];
    let x = v, i = 0;
    while (x >= 1024 && i < u.length - 1) { x /= 1024; i++; }
    return `${x.toFixed(x >= 100 || i === 0 ? 0 : 1)}${u[i]}`;
  },
  ms: (v: number | null | undefined) => (v == null ? "-" : v >= 1000 ? `${(v / 1000).toFixed(2)}s` : `${Math.round(v)}ms`),
  us: (v: number | null | undefined) => (v == null ? "-" : v >= 1000 ? `${(v / 1000).toFixed(1)}ms` : `${Math.round(v)}µs`),
  time: (iso: string) => new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }),
  date: (iso: string) => new Date(iso).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }),
};

export function Box({ title, source, children, className = "", note }: { title: string; source?: string; children: ReactNode; className?: string; note?: string }) {
  return (
    <section className={`border border-ink p-4 flex flex-col gap-3 min-w-0 ${className}`}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        {source ? <code className="font-mono text-[10px] text-ink-soft break-all">{source}</code> : null}
      </header>
      <div className="flex-1 min-h-0 min-w-0">{children}</div>
      {note ? <p className="text-[11px] text-ink-soft">{note}</p> : null}
    </section>
  );
}

export function SectionTitle({ id, children, sub }: { id: string; children: ReactNode; sub?: string }) {
  return (
    <div id={id} className="border-b border-ink pb-2 mt-4 scroll-mt-4 flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-xl font-semibold">{children}</h2>
      {sub ? <span className="text-xs">{sub}</span> : null}
    </div>
  );
}

export function Errors({ errors }: { errors: string[] }) {
  if (!errors.length) return null;
  return (
    <details className="border border-dashed border-ink p-2 text-[11px]">
      <summary className="cursor-pointer">가져오지 못한 항목 {errors.length}건</summary>
      <ul className="mt-1 font-mono break-all">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
    </details>
  );
}

export function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-ink p-4 flex flex-col gap-1 min-w-0">
      <span className="text-xs">{label}</span>
      <span className="font-mono text-2xl sm:text-3xl leading-tight break-all">{value}</span>
      {sub ? <span className="text-[11px] text-ink-soft">{sub}</span> : null}
    </div>
  );
}

export type Bar = { label: string; value: number; display?: string; sub?: string };

export function BarList({ rows, empty = "데이터 없음" }: { rows: Bar[]; empty?: string }) {
  if (!rows.length) return <p className="text-xs text-ink-soft">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  // 글자 위로 막대 테두리가 지나가지 않게, 이름·값 줄 아래에 얇은 막대를 둔다
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r, i) => (
        <li key={`${r.label}-${i}`} className="flex flex-col gap-0.5 text-xs min-w-0">
          <div className="flex items-baseline justify-between gap-3 min-w-0">
            <span className="truncate" title={r.label}>
              {r.label || "(없음)"}{r.sub ? <span className="text-ink-soft"> · {r.sub}</span> : null}
            </span>
            <span className="font-mono shrink-0">{r.display ?? fmt.n(r.value)}</span>
          </div>
          <div className="h-1.5 border border-ink" style={{ width: `${Math.max(1, (r.value / max) * 100)}%`, backgroundImage: HATCH_BAR }} />
        </li>
      ))}
    </ul>
  );
}

const HATCH_BAR = "repeating-linear-gradient(90deg, #000 0 1px, transparent 1px 3px)";

export type Point = { t: string; v: number };

export function LineChart({ series, height = 180, format = fmt.n }: { series: { label: string; points: Point[] }[]; height?: number; format?: (v: number) => string }) {
  const all = series.flatMap((s) => s.points);
  if (!all.length) return <p className="text-xs text-ink-soft">데이터 없음</p>;
  const max = Math.max(...all.map((p) => p.v), 1);
  const n = Math.max(...series.map((s) => s.points.length));
  const path = (pts: Point[]) =>
    pts.map((p, i) => `${n <= 1 ? 50 : (i / (n - 1)) * 100},${100 - (p.v / max) * 95}`).join(" ");
  const first = series[0].points[0]?.t;
  const last = series[0].points.at(-1)?.t;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-[10px] font-mono"><span>최대 {format(max)}</span></div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full" style={{ height }} aria-hidden>
        <line x1="0" y1="99.5" x2="100" y2="99.5" stroke="currentColor" vectorEffect="non-scaling-stroke" />
        {[25, 50, 75].map((y) => <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="currentColor" strokeOpacity="0.12" vectorEffect="non-scaling-stroke" />)}
        {series.map((s, i) => (
          <polyline key={s.label} points={path(s.points)} fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray={i === 0 ? undefined : i === 1 ? "4 3" : "1 3"} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="flex justify-between text-[10px] font-mono"><span>{first ? short(first) : ""}</span><span>{last ? short(last) : ""}</span></div>
      <ul className="flex flex-wrap gap-4 text-xs">
        {series.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2">
            <svg width="20" height="6" aria-hidden><line x1="0" y1="3" x2="20" y2="3" stroke="currentColor" strokeWidth="1.5" strokeDasharray={i === 0 ? undefined : i === 1 ? "4 3" : "1 3"} /></svg>
            {s.label} <span className="font-mono">{format(s.points.reduce((a, p) => a + p.v, 0))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function short(t: string) {
  return t.length <= 10 ? t : fmt.time(t);
}

const HATCH = [
  "none",
  "repeating-linear-gradient(45deg, #000 0 1px, transparent 1px 6px)",
  "repeating-linear-gradient(-45deg, #000 0 1px, transparent 1px 4px)",
  "repeating-linear-gradient(90deg, #000 0 1px, transparent 1px 5px)",
  "repeating-linear-gradient(0deg, #000 0 1px, transparent 1px 4px)",
];

export function SplitBar({ parts }: { parts: { label: string; value: number }[] }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  if (!total) return <p className="text-xs text-ink-soft">데이터 없음</p>;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-7 border border-ink">
        {parts.map((p, i) => (
          <div key={p.label} className={i ? "border-l border-ink" : ""} style={{ width: `${(p.value / total) * 100}%`, backgroundImage: HATCH[i % HATCH.length] }} title={p.label} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {parts.map((p, i) => (
          <li key={p.label} className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 border border-ink" style={{ backgroundImage: HATCH[i % HATCH.length] }} />
            {p.label || "(없음)"} <span className="font-mono">{fmt.pct(p.value / total, 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Waterfall({ steps }: { steps: { label: string; ms: number }[] }) {
  const total = steps.reduce((a, s) => a + Math.max(0, s.ms), 0) || 1;
  const starts = steps.map((_, i) => steps.slice(0, i).reduce((a, s) => a + Math.max(0, s.ms), 0));
  return (
    <ol className="flex flex-col gap-1.5 text-xs">
      {steps.map((s, i) => {
        const left = (starts[i] / total) * 100;
        return (
          <li key={s.label} className="grid grid-cols-[7.5rem_minmax(0,1fr)_4rem] gap-3 items-center">
            <span className="truncate">{s.label}</span>
            <div className="relative h-4">
              <div className="absolute inset-y-0 border border-ink" style={{ left: `${Math.min(left, 99)}%`, width: `${Math.max(0.8, (Math.max(0, s.ms) / total) * 100)}%` }} />
            </div>
            <span className="font-mono text-right">{fmt.ms(s.ms)}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function Columns({ items, format = fmt.ms }: { items: { label: string; value: number | null }[]; format?: (v: number) => string }) {
  const max = Math.max(...items.map((i) => i.value ?? 0), 1);
  return (
    <div className="flex items-end gap-2 h-36">
      {items.map((it) => (
        <div key={it.label} className="flex-1 flex flex-col items-center gap-1 h-full justify-end min-w-0">
          <span className="font-mono text-[10px]">{it.value == null ? "-" : format(it.value)}</span>
          <div className="w-full border border-ink" style={{ height: `${Math.max(2, ((it.value ?? 0) / max) * 80)}%` }} />
          <span className="font-mono text-[10px]">{it.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Table({ columns, rows, empty = "데이터 없음", mono = [] }: { columns: string[]; rows: ReactNode[][]; empty?: string; mono?: number[] }) {
  if (!rows.length) return <p className="text-xs text-ink-soft">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>{columns.map((c) => <th key={c} className="text-left font-semibold border-b border-ink py-1.5 pr-3 whitespace-nowrap">{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="align-top">
              {r.map((c, j) => (
                <td key={j} className={`border-b border-ink/20 py-1.5 pr-3 ${mono.includes(j) ? "font-mono whitespace-nowrap" : "break-all"}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pairs({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-xs">
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-ink-soft">{k}</dt>
          <dd className="font-mono break-all">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
