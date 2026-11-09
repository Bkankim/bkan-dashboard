// 와이어프레임 부품. 실제 데이터 대신 모양만 그린다(검은 선만).
// 각 칸의 `source`는 나중에 꽂을 Cloudflare GraphQL 필드다.

import type { ReactNode } from "react";

export function Box({
  title,
  source,
  children,
  className = "",
}: {
  title: string;
  source: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`border border-ink p-4 flex flex-col gap-3 min-w-0 ${className}`}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold">{title}</h2>
        <code className="font-mono text-[10px] text-ink-soft break-all">{source}</code>
      </header>
      <div className="flex-1 min-h-0">{children}</div>
    </section>
  );
}

export function Kpi({ label, source, unit }: { label: string; source: string; unit?: string }) {
  return (
    <div className="border border-ink p-4 flex flex-col gap-2 min-w-0">
      <span className="text-xs">{label}</span>
      <span className="font-mono text-3xl leading-none">
        000{unit ? <span className="text-base ml-1">{unit}</span> : null}
      </span>
      <Sparkline />
      <code className="font-mono text-[10px] text-ink-soft break-all">{source}</code>
    </div>
  );
}

function Sparkline() {
  return (
    <svg viewBox="0 0 100 20" className="w-full h-5" aria-hidden>
      <polyline
        points="0,15 12,12 24,14 36,8 48,10 60,5 72,9 84,4 100,7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function LineChart({ series }: { series: string[] }) {
  const lines = [
    "0,70 8,64 16,66 24,52 32,56 40,40 48,46 56,30 64,38 72,26 80,34 88,22 100,28",
    "0,82 8,78 16,80 24,70 32,72 40,62 48,66 56,54 64,60 72,50 80,56 88,46 100,52",
  ];
  return (
    <div className="flex flex-col gap-2 h-full">
      <svg viewBox="0 0 100 90" preserveAspectRatio="none" className="w-full h-56" aria-hidden>
        <line x1="0" y1="89.5" x2="100" y2="89.5" stroke="currentColor" vectorEffect="non-scaling-stroke" />
        <line x1="0.5" y1="0" x2="0.5" y2="90" stroke="currentColor" vectorEffect="non-scaling-stroke" />
        {[22, 45, 67].map((y) => (
          <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="currentColor" strokeOpacity="0.15" vectorEffect="non-scaling-stroke" />
        ))}
        {series.map((_, i) => (
          <polyline
            key={i}
            points={lines[i % lines.length]}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray={i === 0 ? undefined : "4 3"}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <Legend items={series.map((s, i) => ({ label: s, dashed: i > 0 }))} />
    </div>
  );
}

function Legend({ items }: { items: { label: string; dashed?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-4 text-xs">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-2">
          <svg width="20" height="6" aria-hidden>
            <line x1="0" y1="3" x2="20" y2="3" stroke="currentColor" strokeWidth="1.5" strokeDasharray={it.dashed ? "4 3" : undefined} />
          </svg>
          {it.label}
        </li>
      ))}
    </ul>
  );
}

// 가로 막대 목록(호스트·경로·유입·브라우저 등)
export function BarList({ rows, valueLabel = "000" }: { rows: string[]; valueLabel?: string }) {
  const widths = [92, 74, 58, 44, 33, 25, 18, 12];
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r, i) => (
        <li key={r} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-center text-xs">
          <div className="relative h-6 min-w-0">
            <div className="absolute inset-y-0 left-0 border border-ink" style={{ width: `${widths[i % widths.length]}%` }} />
            <span className="relative px-2 leading-6 block truncate">{r}</span>
          </div>
          <span className="font-mono">{valueLabel}</span>
        </li>
      ))}
    </ul>
  );
}

// 비율(기기 종류 등): 선만으로 나눈 띠
export function SplitBar({ parts }: { parts: { label: string; pct: number }[] }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-8 border border-ink">
        {parts.map((p, i) => (
          <div
            key={p.label}
            className={i > 0 ? "border-l border-ink" : ""}
            style={{ width: `${p.pct}%`, ...hatch(i) }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {parts.map((p, i) => (
          <li key={p.label} className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 border border-ink" style={hatch(i)} />
            {p.label} <span className="font-mono">00%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// 색 대신 빗금으로 구분한다
function hatch(i: number) {
  const patterns = [
    "none",
    "repeating-linear-gradient(45deg, #000 0 1px, transparent 1px 6px)",
    "repeating-linear-gradient(-45deg, #000 0 1px, transparent 1px 4px)",
    "repeating-linear-gradient(90deg, #000 0 1px, transparent 1px 5px)",
  ];
  return { backgroundImage: patterns[i % patterns.length] };
}

// Web Vitals: 좋음 / 개선 필요 / 나쁨
export function VitalRow({ name, source }: { name: string; source: string }) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_4rem] gap-3 items-center text-xs">
      <span className="font-semibold">{name}</span>
      <div className="flex h-5 border border-ink" title={source}>
        <div style={{ width: "68%" }} />
        <div className="border-l border-ink" style={{ width: "22%", ...hatch(1) }} />
        <div className="border-l border-ink" style={{ width: "10%", ...hatch(2) }} />
      </div>
      <span className="font-mono text-right">P75 000</span>
    </div>
  );
}

export function VitalLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs mt-1">
      {["좋음", "개선 필요", "나쁨"].map((l, i) => (
        <li key={l} className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 border border-ink" style={hatch(i)} />
          {l}
        </li>
      ))}
    </ul>
  );
}

// 페이지 로드 단계(평균 ms)
export function Waterfall({ steps }: { steps: string[] }) {
  return (
    <ol className="flex flex-col gap-1.5 text-xs">
      {steps.map((s, i) => (
        <li key={s} className="grid grid-cols-[7.5rem_minmax(0,1fr)_3.5rem] gap-3 items-center">
          <span className="truncate">{s}</span>
          <div className="relative h-4">
            <div
              className="absolute inset-y-0 border border-ink"
              style={{ left: `${(i / steps.length) * 80}%`, width: `${8 + (i % 3) * 4}%` }}
            />
          </div>
          <span className="font-mono text-right">000ms</span>
        </li>
      ))}
    </ol>
  );
}

// 백분위 분포(P25 ~ P99.9)
export function Quantiles() {
  const qs = ["P25", "P50", "P75", "P90", "P95", "P99", "P99.9"];
  return (
    <div className="flex items-end gap-2 h-32">
      {qs.map((q, i) => (
        <div key={q} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
          <div className="w-full border border-ink" style={{ height: `${15 + i * 12}%` }} />
          <span className="font-mono text-[10px]">{q}</span>
        </div>
      ))}
    </div>
  );
}

// 지도 자리: 와이어프레임 관례대로 X 표시
export function Placeholder({ label }: { label: string }) {
  return (
    <div className="relative h-full min-h-40 border border-ink">
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100" aria-hidden>
        <line x1="0" y1="0" x2="100" y2="100" stroke="currentColor" strokeOpacity="0.3" vectorEffect="non-scaling-stroke" />
        <line x1="100" y1="0" x2="0" y2="100" stroke="currentColor" strokeOpacity="0.3" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs bg-transparent">
        <span className="bg-paper px-2">{label}</span>
      </span>
    </div>
  );
}

export function Table({ columns, rows = 5 }: { columns: string[]; rows?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} className="text-left font-semibold border-b border-ink py-1.5 pr-3 whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r}>
              {columns.map((c, i) => (
                <td key={c} className="border-b border-ink/20 py-1.5 pr-3">
                  {i === 0 ? (
                    <span className="inline-block h-2 border-b border-ink" style={{ width: `${60 + ((r * 13) % 35)}%` }} />
                  ) : (
                    <span className="font-mono">000</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
