// 기간·사이트 선택. URL 쿼리(?range=24h&host=blog.bkan.dev)로 정한다.

export const RANGES = {
  "30m": { label: "30분", seconds: 30 * 60, bucket: "datetimeMinute" },
  "24h": { label: "24시간", seconds: 24 * 3600, bucket: "datetimeHour" },
  "7d": { label: "7일", seconds: 7 * 86400, bucket: "datetimeHour" },
  "30d": { label: "30일", seconds: 30 * 86400 - 120, bucket: "date" },
} as const;

export type RangeKey = keyof typeof RANGES;

export const HOSTS = ["bkan.dev", "portfolio.bkan.dev", "blog.bkan.dev", "lab.bkan.dev"] as const;

export function parseRange(v: string | string[] | undefined): RangeKey {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s in RANGES ? (s as RangeKey) : "24h";
}

export function parseHost(v: string | string[] | undefined): string | null {
  const s = Array.isArray(v) ? v[0] : v;
  return s && (HOSTS as readonly string[]).includes(s) ? s : null;
}

export function timeWindow(range: RangeKey, now = new Date()) {
  const end = new Date(Math.floor(now.getTime() / 60000) * 60000);
  const start = new Date(end.getTime() - RANGES[range].seconds * 1000);
  const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
  return { start: iso(start), end: iso(end), startDate: iso(start).slice(0, 10), endDate: iso(end).slice(0, 10) };
}
