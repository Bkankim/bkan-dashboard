// Cloudflare 데이터 묶음. 섹션 하나 = GraphQL 질의 한 번(별칭으로 여러 데이터셋을 묶음) 또는 REST 몇 번.
// 60초 캐시: 새로고침을 연타해도 API 한도(5분 300회)를 쓰지 않게.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { cacheLife } from "next/cache";
import { accountId, gql, rest } from "./client";
import { RANGES, type RangeKey, timeWindow } from "./range";

export type Row = Record<string, any>;
export type Section = { rows: Record<string, Row[]>; errors: string[] };

// 60초마다 백그라운드로 새로 받고, 하루 동안은 옛 값을 먼저 보여 준다(빈 캐시 대기는 재시작 직후에만)
const CACHE = { stale: 60, revalidate: 60, expire: 86400 };

function lit(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return `[${v.map(lit).join(",")}]`;
  return `{${Object.entries(v as Record<string, unknown>)
    .filter(([, x]) => x !== undefined)
    .map(([k, x]) => `${k}:${lit(x)}`)
    .join(",")}}`;
}

type Part = { alias: string; ds: string; limit: number; filter: object; select: string; orderBy?: string };

// 별칭을 한 질의에 많이 묶으면 Cloudflare가 차례로 처리해 느려진다(RUM 21개 묶음 4초, 2026-11-10 측정).
// CHUNK개씩 나눠 동시에 보낸다. 한도는 별칭(노드) 수로 세므로 나눠도 쓰는 양은 같다.
const CHUNK = 6;

async function runOne(scope: "account" | "zone", tag: string, parts: Part[]): Promise<Section> {
  const node = scope === "account" ? "accounts(filter:{accountTag:$tag})" : "zones(filter:{zoneTag:$tag})";
  const body = parts
    .map((p) => `${p.alias}: ${p.ds}(limit:${p.limit}, filter:${lit(p.filter)}${p.orderBy ? `, orderBy:[${p.orderBy}]` : ""}){${p.select}}`)
    .join("\n");
  const r = await gql<{ viewer: Record<string, Row[]> }>(`query($tag:String!){viewer{${node}{${body}}}}`, { tag });
  const root = r.data?.viewer?.[scope === "account" ? "accounts" : "zones"]?.[0] ?? {};
  const rows: Record<string, Row[]> = {};
  for (const p of parts) rows[p.alias] = (root[p.alias] as Row[]) ?? [];
  return { rows, errors: r.errors };
}

async function run(scope: "account" | "zone", tag: string, parts: Part[]): Promise<Section> {
  const chunks: Part[][] = [];
  for (let i = 0; i < parts.length; i += CHUNK) chunks.push(parts.slice(i, i + CHUNK));
  const results = await Promise.all(chunks.map((c) => runOne(scope, tag, c)));
  return {
    rows: Object.assign({}, ...results.map((r) => r.rows)),
    errors: results.flatMap((r) => r.errors),
  };
}

export async function zoneId(): Promise<string | null> {
  "use cache";
  cacheLife("hours");
  const z = await rest<{ id: string; name: string }[]>("/zones?name=bkan.dev");
  return z.result?.[0]?.id ?? null;
}

function by(dim: string, metric = "count", limit = 15, extra = "") {
  const order = metric === "count" ? "count_DESC" : `${metric.replace(/[{}]/g, "").replace(/ /g, "_")}_DESC`;
  return { dim, limit, order, extra, metric };
}

// ── Web Analytics (RUM) ──────────────────────────────────────────────
export async function rumSection(range: RangeKey, host: string | null): Promise<Section> {
  "use cache";
  cacheLife(CACHE);
  const w = timeWindow(range);
  const base = { datetime_geq: w.start, datetime_leq: w.end, requestHost: host ?? undefined };
  const human = { ...base, bot: 0 };
  const bucket = RANGES[range].bucket;
  const PL = "rumPageloadEventsAdaptiveGroups";
  const groups: [string, ReturnType<typeof by>][] = [
    ["hosts", by("requestHost", "sum_visits", 10)],
    ["paths", by("requestHost requestPath", "count", 15)],
    ["referers", by("refererHost", "sum_visits", 15)],
    ["refererPaths", by("refererHost refererPath", "sum_visits", 15)],
    ["countries", by("countryName", "sum_visits", 20)],
    ["devices", by("deviceType", "sum_visits", 5)],
    ["nav", by("navigationType", "count", 6)],
    ["delivery", by("deliveryType", "count", 6)],
    ["browsers", by("userAgentBrowser", "sum_visits", 10)],
    ["os", by("userAgentOS", "sum_visits", 10)],
    ["engines", by("browserEngine", "sum_visits", 6)],
    ["schemes", by("requestScheme", "count", 4)],
  ];
  const parts: Part[] = [
    { alias: "total", ds: PL, limit: 1, filter: human, select: "count sum{visits}" },
    { alias: "bots", ds: PL, limit: 3, filter: base, select: "count dimensions{bot}" },
    { alias: "series", ds: PL, limit: 2000, filter: human, select: `count sum{visits} dimensions{t:${bucket}}`, orderBy: `${bucket}_ASC` },
    ...groups.map(([alias, g]) => ({
      alias, ds: PL, limit: g.limit, filter: human,
      select: `count sum{visits} dimensions{${g.dim}}`,
      orderBy: g.order,
    })),
    {
      alias: "perf", ds: "rumPerformanceEventsAdaptiveGroups", limit: 1, filter: human,
      select:
        "count avg{redirectTime dnsTime connectionTime tlsTime requestTime responseTime firstPaint firstContentfulPaint pageRenderTime loadEventTime pageLoadTime}" +
        " quantiles{pageLoadTimeP25 pageLoadTimeP50 pageLoadTimeP75 pageLoadTimeP90 pageLoadTimeP95 pageLoadTimeP99 pageLoadTimeP999}",
    },
    {
      alias: "perfByHost", ds: "rumPerformanceEventsAdaptiveGroups", limit: 10, filter: human, orderBy: "count_DESC",
      select: "count quantiles{pageLoadTimeP50 pageLoadTimeP95} dimensions{requestHost}",
    },
    {
      alias: "vitals", ds: "rumWebVitalsEventsAdaptiveGroups", limit: 1, filter: human,
      select:
        "count sum{lcpGood lcpNeedsImprovement lcpPoor inpGood inpNeedsImprovement inpPoor clsGood clsNeedsImprovement clsPoor fcpGood fcpNeedsImprovement fcpPoor ttfbGood ttfbNeedsImprovement ttfbPoor}" +
        " quantiles{largestContentfulPaintP75 interactionToNextPaintP75 cumulativeLayoutShiftP75 firstContentfulPaintP75 timeToFirstByteP75}" +
        " avg{inpInputDelay inpProcessingDuration inpPresentationDelay lcpResourceLoadDelay lcpResourceLoadTime lcpElementRenderDelay}",
    },
    ...(["largestContentfulPaint", "cumulativeLayoutShift", "interactionToNextPaint"] as const).map((m) => ({
      alias: `el_${m}`, ds: "rumWebVitalsEventsAdaptiveGroups", limit: 8, filter: human, orderBy: "count_DESC",
      select: `count quantiles{${m === "cumulativeLayoutShift" ? "cumulativeLayoutShiftP75" : `${m}P75`}} dimensions{${m}Element ${m}Path}`,
    })),
  ];
  return run("account", accountId(), parts);
}

// ── 엣지 트래픽 (프록시를 거친 요청: bkan.dev·portfolio·blog 등) ──────
export async function edgeSection(range: RangeKey, host: string | null): Promise<Section> {
  "use cache";
  cacheLife(CACHE);
  const z = await zoneId();
  if (!z) return { rows: {}, errors: ["zone id 없음"] };
  const w = timeWindow(range);
  const f = { datetime_geq: w.start, datetime_leq: w.end, clientRequestHTTPHost: host ?? undefined };
  const bucket = RANGES[range].bucket;
  const DS = "httpRequestsAdaptiveGroups";
  const g = (alias: string, dim: string, limit = 15): Part => ({
    alias, ds: DS, limit, filter: f, orderBy: "count_DESC", select: `count sum{edgeResponseBytes visits} dimensions{${dim}}`,
  });
  return run("zone", z, [
    { alias: "total", ds: DS, limit: 1, filter: f, select: "count sum{edgeResponseBytes edgeRequestBytes visits} ratio{status4xx status5xx}" },
    { alias: "series", ds: DS, limit: 2000, filter: f, orderBy: `${bucket}_ASC`, select: `count sum{edgeResponseBytes visits} dimensions{t:${bucket}}` },
    g("hosts", "clientRequestHTTPHost", 20),
    g("paths", "clientRequestHTTPHost clientRequestPath", 25),
    g("status", "edgeResponseStatus", 15),
    g("cache", "cacheStatus", 10),
    g("countries", "clientCountryName", 20),
    g("ips", "clientIP clientCountryName", 25),
    g("devices", "clientDeviceType", 6),
    g("browsers", "userAgentBrowser", 12),
    g("os", "userAgentOS", 10),
    g("userAgents", "userAgent", 15),
    g("bots", "verifiedBotCategory", 15),
    g("methods", "clientRequestHTTPMethodName", 8),
    g("protocols", "clientRequestHTTPProtocol", 6),
    g("tls", "clientSSLProtocol", 6),
    g("contentTypes", "edgeResponseContentTypeName", 12),
    g("colos", "coloCode", 12),
    g("securityActions", "securityAction securitySource", 12),
    g("requestSource", "requestSource", 6),
    {
      alias: "origin", ds: DS, limit: 1, filter: f,
      select: "quantiles{originResponseDurationMsP50 originResponseDurationMsP95 originResponseDurationMsP99} avg{originResponseDurationMs originTcpHandshakeDurationMs originTlsHandshakeDurationMs}",
    },
  ]);
}

// 365일 일별 (기간 선택과 무관하게 장기 추이)
export async function edgeHistory(host: string | null): Promise<Section> {
  "use cache";
  cacheLife("hours");
  const z = await zoneId();
  if (!z) return { rows: {}, errors: ["zone id 없음"] };
  const end = new Date();
  const start = new Date(end.getTime() - 364 * 86400_000);
  void host; // 1d 그룹은 호스트로 나눌 수 없다
  return run("zone", z, [
    {
      alias: "days", ds: "httpRequests1dGroups", limit: 400, orderBy: "date_ASC",
      filter: { date_geq: start.toISOString().slice(0, 10), date_leq: end.toISOString().slice(0, 10) },
      select: "sum{requests bytes cachedRequests cachedBytes threats pageViews encryptedRequests} uniq{uniques} dimensions{date}",
    },
  ]);
}

// ── 요청 원본 기록 (샘플) ─────────────────────────────────────────────
export async function requestLog(range: RangeKey, host: string | null): Promise<Section> {
  "use cache";
  cacheLife(CACHE);
  const z = await zoneId();
  if (!z) return { rows: {}, errors: ["zone id 없음"] };
  const w = timeWindow(range);
  return run("zone", z, [
    {
      alias: "log", ds: "httpRequestsAdaptive", limit: 100, orderBy: "datetime_DESC",
      filter: { datetime_geq: w.start, datetime_leq: w.end, clientRequestHTTPHost: host ?? undefined },
      select:
        "datetime clientIP clientCountryName clientASNDescription clientRequestHTTPHost clientRequestHTTPMethodName clientRequestPath clientRequestQuery edgeResponseStatus cacheStatus userAgentBrowser userAgentOS userAgent verifiedBotCategory securityAction rayName",
    },
  ]);
}

// ── 보안 ──────────────────────────────────────────────────────────────
export async function securitySection(range: RangeKey, host: string | null): Promise<Section> {
  "use cache";
  cacheLife(CACHE);
  const z = await zoneId();
  if (!z) return { rows: {}, errors: ["zone id 없음"] };
  const w = timeWindow(range);
  const f = { datetime_geq: w.start, datetime_leq: w.end, clientRequestHTTPHost: host ?? undefined };
  return run("zone", z, [
    {
      alias: "events", ds: "firewallEventsAdaptive", limit: 1000, orderBy: "datetime_DESC", filter: f,
      select:
        "datetime action source description ruleId clientIP clientCountryName clientASNDescription clientIPClass clientRequestHTTPHost clientRequestHTTPMethodName clientRequestPath clientRequestQuery clientRefererHost userAgent verifiedBotCategory edgeResponseStatus rayName",
    },
    { alias: "total", ds: "firewallEventsAdaptiveByTimeGroups", limit: 1, filter: f, select: "count" },
  ]);
}

// ── DNS ───────────────────────────────────────────────────────────────
export async function dnsSection(range: RangeKey): Promise<Section> {
  "use cache";
  cacheLife(CACHE);
  const z = await zoneId();
  if (!z) return { rows: {}, errors: ["zone id 없음"] };
  const w = timeWindow(range);
  const f = { datetime_geq: w.start, datetime_leq: w.end };
  const bucket = RANGES[range].bucket;
  const DS = "dnsAnalyticsAdaptiveGroups";
  const g = (alias: string, dim: string, limit = 15): Part => ({ alias, ds: DS, limit, filter: f, orderBy: "count_DESC", select: `count dimensions{${dim}}` });
  return run("zone", z, [
    { alias: "total", ds: DS, limit: 1, filter: f, select: "count avg{processingTimeUs} quantiles{processingTimeUsP50 processingTimeUsP99}" },
    { alias: "series", ds: DS, limit: 2000, filter: f, orderBy: `${bucket}_ASC`, select: `count dimensions{t:${bucket}}` },
    g("names", "queryName", 20),
    g("types", "queryType", 12),
    g("codes", "responseCode", 8),
    g("colos", "coloName", 12),
    g("protocols", "protocol ipVersion", 8),
    g("cached", "responseCached", 3),
    g("sources", "sourceIP", 15),
  ]);
}

// ── 플랫폼 (Pages Functions, Workers, R2, 감사 로그) ───────────────────
export async function platformSection(range: RangeKey): Promise<Section> {
  "use cache";
  cacheLife(CACHE);
  const w = timeWindow(range);
  const f = { datetime_geq: w.start, datetime_leq: w.end };
  const bucket = RANGES[range].bucket;
  return run("account", accountId(), [
    {
      alias: "functions", ds: "pagesFunctionsInvocationsAdaptiveGroups", limit: 20, filter: f, orderBy: "sum_requests_DESC",
      select: "sum{requests errors subrequests responseBodySize clientDisconnects wallTime} quantiles{cpuTimeP50 cpuTimeP99 durationP50 durationP99} dimensions{scriptName status}",
    },
    {
      alias: "functionsSeries", ds: "pagesFunctionsInvocationsAdaptiveGroups", limit: 2000, filter: f, orderBy: `${bucket}_ASC`,
      select: `sum{requests errors} dimensions{t:${bucket}}`,
    },
    { alias: "workers", ds: "workersOverviewRequestsAdaptiveGroups", limit: 20, filter: f, orderBy: "count_DESC", select: "count sum{cpuTimeUs} dimensions{scriptName status usageModel}" },
    { alias: "r2Storage", ds: "r2StorageAdaptiveGroups", limit: 20, filter: f, orderBy: "max_payloadSize_DESC", select: "max{objectCount payloadSize metadataSize uploadCount} dimensions{bucketName}" },
    { alias: "r2Ops", ds: "r2OperationsAdaptiveGroups", limit: 30, filter: f, orderBy: "sum_requests_DESC", select: "sum{requests responseBytes} dimensions{bucketName actionType}" },
    { alias: "audit", ds: "auditLogsGroups", limit: 30, filter: { datetimeHour_geq: w.start, datetimeHour_leq: w.end }, orderBy: "count_DESC", select: "count dimensions{actionType resourceProduct resourceType actorType actionResult}" },
    { alias: "overviewBytes", ds: "httpRequestsOverviewAdaptiveGroups", limit: 1, filter: f, select: "sum{bytes requests cachedBytes}" },
  ]);
}

// ── REST 묶음 ─────────────────────────────────────────────────────────
export type RestSection = { data: Record<string, any>; errors: string[] };

export async function restSection(): Promise<RestSection> {
  "use cache";
  cacheLife({ stale: 120, revalidate: 300, expire: 3600 });
  const a = accountId();
  const z = await zoneId();
  const calls: Record<string, string> = {
    projects: `/accounts/${a}/pages/projects`,
    registrar: `/accounts/${a}/registrar/domains`,
    insights: `/accounts/${a}/security-center/insights?per_page=100`,
    rumSites: `/accounts/${a}/rum/site_info/list`,
    policies: `/accounts/${a}/alerting/v3/policies`,
    r2: `/accounts/${a}/r2/buckets`,
    audit: `/accounts/${a}/audit_logs?per_page=25&direction=desc`,
    rank: "/radar/ranking/domain/bkan.dev",
    aiBots: "/radar/ai/bots/summary/user_agent?dateRange=7d",
    verifiedBots: "/radar/verified_bots/top/bots?dateRange=7d&limit=10",
  };
  if (z) {
    Object.assign(calls, {
      zone: `/zones/${z}`,
      dns: `/zones/${z}/dns_records?per_page=100`,
      settings: `/zones/${z}/settings`,
      certs: `/zones/${z}/ssl/certificate_packs`,
      dnssec: `/zones/${z}/dnssec`,
      emailRouting: `/zones/${z}/email/routing`,
      emailRules: `/zones/${z}/email/routing/rules`,
      bot: `/zones/${z}/bot_management`,
      rulesets: `/zones/${z}/rulesets`,
    });
  }
  const entries = await Promise.all(Object.entries(calls).map(async ([k, p]) => [k, await rest<any>(p)] as const));
  const data: Record<string, any> = {};
  const errors: string[] = [];
  for (const [k, r] of entries) {
    data[k] = r.result;
    if (r.error) errors.push(`${k}: ${r.error}`);
  }
  // 프로젝트마다 최근 배포 5개
  const projects = (data.projects as { name: string }[] | null) ?? [];
  const deps = await Promise.all(
    projects.map(async (p) => [p.name, await rest<any[]>(`/accounts/${a}/pages/projects/${p.name}/deployments?per_page=5`)] as const),
  );
  data.deployments = Object.fromEntries(deps.map(([n, r]) => [n, r.result ?? []]));
  data.fetchedAt = Date.now();
  return { data, errors };
}
