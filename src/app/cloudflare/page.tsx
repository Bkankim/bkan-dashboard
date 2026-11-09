// Cloudflare - API로 받을 수 있는 사이트 데이터 전부 (조사: docs/research/cloudflare-data.md)
// 제목은 정적 셸, 나머지는 요청 때 받아 섹션마다 Suspense 뒤에서 채운다.

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { SectionTitle } from "@/components/viz";
import { HOSTS, parseHost, parseRange, RANGES, type RangeKey } from "@/lib/cf/range";
import { DomainAccount, Dns, Internet, Platform, Security } from "./sections-ops";
import { Edge, EdgeHistory, RequestLog, WebAnalytics } from "./sections-traffic";

export const metadata: Metadata = { title: "Cloudflare" };

const SECTIONS = [
  ["web", "방문 (Web Analytics)"],
  ["edge", "엣지 트래픽"],
  ["history", "365일 추이"],
  ["log", "요청 기록"],
  ["security", "보안"],
  ["dns", "DNS"],
  ["platform", "플랫폼"],
  ["domain", "도메인 · 계정"],
  ["internet", "인터넷"],
] as const;

export default function CloudflarePage({ searchParams }: PageProps<"/cloudflare">) {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Link href="/" className="text-xs underline underline-offset-2 w-fit">← bkan dashboard</Link>
        <h1 className="text-3xl font-semibold tracking-tight">Cloudflare</h1>
      </header>
      <Suspense fallback={<Loading />}>
        <Body searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Body({ searchParams }: { searchParams: PageProps<"/cloudflare">["searchParams"] }) {
  const sp = await searchParams;
  const range = parseRange(sp.range);
  const host = parseHost(sp.host);
  const href = (r: RangeKey, h: string | null) => `/cloudflare?range=${r}${h ? `&host=${h}` : ""}`;
  return (
    <>
      <div className="sticky top-0 z-10 bg-paper border-b border-ink py-3 flex flex-col gap-3" style={{ top: "env(safe-area-inset-top, 0px)" }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="사이트" className="flex flex-wrap gap-2 text-xs">
            {[null, ...HOSTS].map((h) => (
              <Link key={h ?? "all"} href={href(range, h)} className={`border border-ink px-3 py-1.5 ${h === host ? "bg-ink text-paper" : ""}`}>{h ?? "전체"}</Link>
            ))}
          </nav>
          <div role="group" aria-label="기간" className="flex border border-ink text-xs">
            {(Object.keys(RANGES) as RangeKey[]).map((r, i) => (
              <Link key={r} href={href(r, host)} className={`px-3 py-1.5 ${i ? "border-l border-ink" : ""} ${r === range ? "bg-ink text-paper" : ""}`}>{RANGES[r].label}</Link>
            ))}
          </div>
        </div>
        <nav aria-label="섹션" className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {SECTIONS.map(([id, label]) => <a key={id} href={`#${id}`} className="underline underline-offset-2">{label}</a>)}
        </nav>
      </div>
      <p className="text-[11px]">값은 60초 캐시. 봇은 Web Analytics에서 빼고 본다. lab.bkan.dev는 DNS only라 엣지·보안·요청 기록에 없다.</p>

      <S id="web" title="방문 (Web Analytics)" sub="브라우저 beacon 기준, 4개 사이트"><WebAnalytics range={range} host={host} /></S>
      <S id="edge" title="엣지 트래픽" sub="Cloudflare 프록시를 거친 모든 요청(봇 포함)"><Edge range={range} host={host} /></S>
      <S id="history" title="365일 추이" sub="기간 선택과 무관, 존 전체 일별"><EdgeHistory /></S>
      <S id="log" title="요청 기록" sub="원본 기록 샘플"><RequestLog range={range} host={host} /></S>
      <S id="security" title="보안" sub="방화벽 이벤트 · Security Center · 보안 설정"><Security range={range} host={host} /></S>
      <S id="dns" title="DNS" sub="bkan.dev 존 권한 DNS"><Dns range={range} /></S>
      <S id="platform" title="플랫폼" sub="Pages · Functions · Workers · R2 · 계정 변경 기록"><Platform range={range} /></S>
      <S id="domain" title="도메인 · 계정" sub="등록 · 인증서 · 설정"><DomainAccount /></S>
      <S id="internet" title="인터넷" sub="Cloudflare Radar"><Internet /></S>
    </>
  );
}

function S({ id, title, sub, children }: { id: string; title: string; sub?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4" aria-labelledby={`${id}-t`}>
      <SectionTitle id={id} sub={sub}>{title}</SectionTitle>
      <Suspense fallback={<Loading />}>{children}</Suspense>
    </section>
  );
}

function Loading() {
  return <p className="text-xs text-ink-soft">불러오는 중</p>;
}
