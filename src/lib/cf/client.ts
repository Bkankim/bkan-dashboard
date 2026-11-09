// Cloudflare API 호출. 서버에서만 쓴다(토큰은 with-secret이 서버 프로세스에만 넣는다).
import "server-only";

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

export async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<GqlResult<T>> {
  const res = await fetch(`${API}/graphql`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  if (!res.ok) return { data: null, errors: [`HTTP ${res.status}`] };
  const body = (await res.json()) as { data?: T; errors?: { message: string; path?: string[] }[] };
  return {
    data: body.data ?? null,
    errors: (body.errors ?? []).map((e) => (e.path ? `${e.path.join(".")}: ` : "") + e.message),
  };
}

export type RestResult<T> = { result: T | null; error: string | null };

export async function rest<T>(path: string): Promise<RestResult<T>> {
  try {
    const res = await fetch(`${API}${path}`, {
      headers: { Authorization: `Bearer ${token()}` },
      cache: "no-store",
    });
    const body = (await res.json()) as { result?: T; errors?: { message: string }[] };
    if (!res.ok) return { result: null, error: `HTTP ${res.status} ${body.errors?.[0]?.message ?? ""}`.trim() };
    return { result: body.result ?? null, error: null };
  } catch (e) {
    return { result: null, error: String(e) };
  }
}
