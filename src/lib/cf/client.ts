// Cloudflare API 호출. 서버에서만 쓴다(토큰은 with-secret이 서버 프로세스에만 넣는다).
import "server-only";
import { request as httpsRequest } from "node:https";
import { monitorEventLoopDelay } from "node:perf_hooks";

// Next가 바꿔 끼운 전역 fetch 대신 node:https로 직접 호출한다.
// 같은 동시 호출이 순수 Node fetch로는 1.1초, Next fetch로는 5~6초였다(2026-11-10 측정, 응답이 서로 줄을 섬).
// 캐시는 use cache가 맡으므로 Next fetch의 캐시 기능은 필요 없다.
function call(method: "GET" | "POST", url: string, headers: Record<string, string>, body?: string): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(url, { method, headers: { ...headers, ...(body ? { "Content-Length": Buffer.byteLength(body).toString() } : {}) }, timeout: 30_000 }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("timeout", () => req.destroy(new Error("timeout 30s")));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

const API = "https://api.cloudflare.com/client/v4";

function token(): string {
  const t = process.env.CF_API_TOKEN;
  if (!t) throw new Error("CF_API_TOKEN 없음 - with-secret으로 띄웠는지 확인");
  return t;
}

export function accountId(): string {
  const a = process.env.CF_ACCOUNT_ID;
  if (!a) throw new Error("CF_ACCOUNT_ID 없음");
  return a;
}

export type GqlResult<T> = { data: T | null; errors: string[] };

// 병목 측정용: CF_TIMING=1이면 호출마다 시간·크기를 로그에 남긴다
const TIMING = process.env.CF_TIMING === "1";
const loop = TIMING ? monitorEventLoopDelay({ resolution: 10 }) : null;
loop?.enable();
function logTiming(kind: string, label: string, t0: number, bytes: number, status: number) {
  if (!TIMING) return;
  const lag = loop ? Math.round(loop.max / 1e6) : 0;
  loop?.reset();
  console.log(`[cf-timing] ${new Date().toISOString()} ${kind} ${label} ${Math.round(performance.now() - t0)}ms ${bytes}B ${status} loopMax=${lag}ms`);
}

export async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<GqlResult<T>> {
  const t0 = performance.now();
  const label = (query.match(/\{(\w+): (\w+)\(/) ?? [])[2] ?? "query";
  let res: { status: number; text: string };
  try {
    res = await call("POST", `${API}/graphql`, { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" }, JSON.stringify({ query, variables }));
  } catch (e) {
    return { data: null, errors: [String(e)] };
  }
  const text = res.text;
  logTiming("gql", label, t0, text.length, res.status);
  if (res.status !== 200) return { data: null, errors: [`HTTP ${res.status}`] };
  const body = JSON.parse(text) as { data?: T; errors?: { message: string; path?: string[] }[] };
  return {
    data: body.data ?? null,
    errors: (body.errors ?? []).map((e) => (e.path ? `${e.path.join(".")}: ` : "") + e.message),
  };
}

export type RestResult<T> = { result: T | null; error: string | null };

export async function rest<T>(path: string): Promise<RestResult<T>> {
  const t0 = performance.now();
  try {
    const res = await call("GET", `${API}${path}`, { Authorization: `Bearer ${token()}` });
    const text = res.text;
    logTiming("rest", path.replace(/[0-9a-f]{32}/g, "{id}").split("?")[0], t0, text.length, res.status);
    const body = JSON.parse(text) as { result?: T; errors?: { message: string }[] };
    if (res.status < 200 || res.status >= 300) return { result: null, error: `HTTP ${res.status} ${body.errors?.[0]?.message ?? ""}`.trim() };
    return { result: body.result ?? null, error: null };
  } catch (e) {
    return { result: null, error: String(e) };
  }
}
