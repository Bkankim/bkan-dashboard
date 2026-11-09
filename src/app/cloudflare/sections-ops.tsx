// 운영 쪽 섹션: 보안, DNS, 플랫폼(Pages·Functions·Workers·R2·감사 로그), 도메인·계정, 인터넷(Radar)
/* eslint-disable @typescript-eslint/no-explicit-any */
import { BarList, Box, Errors, fmt, Kpi, LineChart, Pairs, SplitBar, Table, type Bar } from "@/components/viz";
import { dnsSection, platformSection, restSection, securitySection, type Row } from "@/lib/cf/queries";
import type { RangeKey } from "@/lib/cf/range";

const count = (r: Row) => r.count ?? 0;
function tally(rows: Row[], key: (r: Row) => string, limit = 15): Bar[] {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([label, value]) => ({ label, value }));
}

export async function Security({ range, host }: { range: RangeKey; host: string | null }) {
  if (host === "lab.bkan.dev") return <p className="text-xs">lab.bkan.dev는 DNS only라 보안 이벤트가 없다.</p>;
  const [{ rows: R, errors }, rs] = await Promise.all([securitySection(range, host), restSection()]);
  const ev = R.events ?? [];
  const total = R.total?.[0]?.count ?? ev.length;
  const insights: any[] = rs.data.insights?.issues ?? [];
  const bot = rs.data.bot ?? {};
  const st: Record<string, any> = Object.fromEntries((rs.data.settings ?? []).map((s: any) => [s.id, s.value]));
  return (
    <>
      <Errors errors={errors} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="보안 이벤트" value={fmt.n(total)} sub={ev.length < total ? `아래 집계는 최근 ${fmt.n(ev.length)}건 기준` : undefined} />
        <Kpi label="고유 IP" value={fmt.n(new Set(ev.map((e) => e.clientIP)).size)} />
        <Kpi label="국가" value={fmt.n(new Set(ev.map((e) => e.clientCountryName)).size)} />
        <Kpi label="Security Center 지적" value={fmt.n(insights.length)} sub={`중간 ${insights.filter((i) => i.severity === "Moderate").length} · 낮음 ${insights.filter((i) => i.severity === "Low").length}`} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Box title="처리 방식" source="action"><BarList rows={tally(ev, (e) => e.action)} /></Box>
        <Box title="탐지 기능" source="source"><BarList rows={tally(ev, (e) => e.source)} /></Box>
        <Box title="노린 호스트" source="clientRequestHTTPHost"><BarList rows={tally(ev, (e) => e.clientRequestHTTPHost)} /></Box>
        <Box title="국가" source="clientCountryName"><BarList rows={tally(ev, (e) => e.clientCountryName)} /></Box>
        <Box title="노린 경로" source="clientRequestPath" className="xl:col-span-2"><BarList rows={tally(ev, (e) => e.clientRequestPath, 20)} /></Box>
        <Box title="IP · ASN" source="clientIP · clientASNDescription" className="xl:col-span-2"><BarList rows={tally(ev, (e) => `${e.clientIP} · ${e.clientCountryName} · ${e.clientASNDescription ?? ""}`, 20)} /></Box>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Box title="User-Agent" source="userAgent"><BarList rows={tally(ev, (e) => e.userAgent || "(없음)", 12)} /></Box>
        <Box title="규칙 설명" source="description · ruleId"><BarList rows={tally(ev, (e) => e.description || e.ruleId || "(없음)", 12)} /></Box>
      </div>
      <Box title="최근 보안 이벤트" source="firewallEventsAdaptive">
        <Table columns={["시각(KST)", "처리", "기능", "IP · 국가", "요청", "UA"]} mono={[0, 1]} rows={ev.slice(0, 60).map((e) => [
          fmt.time(e.datetime), e.action, e.source, `${e.clientIP} · ${e.clientCountryName}`,
          `${e.clientRequestHTTPMethodName} ${e.clientRequestHTTPHost}${e.clientRequestPath}${e.clientRequestQuery ?? ""}`,
          <span key="u" className="text-ink-soft">{e.userAgent}</span>,
        ])} />
      </Box>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Box title="Security Center 지적" source="REST security-center/insights" className="lg:col-span-2">
          <Table columns={["심각도", "종류", "대상", "내용"]} mono={[0]} rows={insights.map((i) => [i.severity, i.issue_type, i.subject, i.issue_class])} />
        </Box>
        <Box title="보안 관련 설정" source="REST bot_management · zone settings · dnssec">
          <Pairs items={[
            ["Bot Fight Mode", String(bot.fight_mode)],
            ["크롤러 보호(링크 미로)", String(bot.crawler_protection)],
            ["AI 봇 차단", String(bot.ai_bots_protection)],
            ["JS 탐지", String(bot.enable_js)],
            ["SSL 모드", st.ssl],
            ["항상 HTTPS", st.always_use_https],
            ["최소 TLS", st.min_tls_version],
            ["TLS 1.3", st.tls_1_3],
            ["HSTS", st.security_header?.strict_transport_security?.enabled ? "on" : "off"],
            ["보안 수준", st.security_level],
            ["브라우저 무결성 검사", st.browser_check],
            ["DNSSEC", rs.data.dnssec?.status],
          ]} />
        </Box>
      </div>
    </>
  );
}

export async function Dns({ range }: { range: RangeKey }) {
  const [{ rows: R, errors }, rs] = await Promise.all([dnsSection(range), restSection()]);
  const t = R.total?.[0];
  const records: any[] = rs.data.dns ?? [];
  const b = (k: string) => (R[k] ?? []).map((r: Row) => ({ label: Object.values(r.dimensions ?? {}).join(" · ") || "(없음)", value: count(r) }));
  return (
    <>
      <Errors errors={errors} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="DNS 질의" value={fmt.n(t?.count)} />
        <Kpi label="처리 시간 평균" value={fmt.us(t?.avg?.processingTimeUs)} />
        <Kpi label="P50 / P99" value={`${fmt.us(t?.quantiles?.processingTimeUsP50)} / ${fmt.us(t?.quantiles?.processingTimeUsP99)}`} />
        <Kpi label="DNS 레코드" value={fmt.n(records.length)} sub={`프록시 ${records.filter((r) => r.proxied).length}`} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Box title="시간대별 질의" source="dnsAnalyticsAdaptiveGroups" className="lg:col-span-2">
          <LineChart series={[{ label: "질의", points: (R.series ?? []).map((r) => ({ t: r.dimensions.t, v: count(r) })) }]} />
        </Box>
        <Box title="많이 물어본 이름" source="queryName"><BarList rows={b("names")} /></Box>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Box title="레코드 종류" source="queryType"><BarList rows={b("types")} /></Box>
        <Box title="응답 코드" source="responseCode"><BarList rows={b("codes")} /></Box>
        <Box title="응답한 데이터센터" source="coloName"><BarList rows={b("colos")} /></Box>
        <Box title="프로토콜 · IP 버전 · 캐시" source="protocol · ipVersion · responseCached">
          <BarList rows={b("protocols")} />
          <div className="mt-3"><SplitBar parts={(R.cached ?? []).map((r) => ({ label: r.dimensions.responseCached ? "캐시" : "캐시 아님", value: count(r) }))} /></div>
        </Box>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Box title="질의 보낸 리졸버 IP" source="sourceIP" note="방문자 IP가 아니라 방문자가 쓰는 DNS 리졸버(통신사·구글 등)의 IP다.">
          <BarList rows={b("sources")} />
        </Box>
        <Box title="DNS 레코드" source="REST dns_records" className="lg:col-span-2">
          <Table columns={["종류", "이름", "값", "프록시", "TTL"]} mono={[0, 3, 4]} rows={records
            .sort((a, b2) => a.type.localeCompare(b2.type) || a.name.localeCompare(b2.name))
            .map((r) => [r.type, r.name, <span key="c" className="text-ink-soft">{String(r.content).slice(0, 120)}</span>, r.proxied ? "on" : "off", r.ttl === 1 ? "auto" : r.ttl])} />
        </Box>
      </div>
    </>
  );
}

export async function Platform({ range }: { range: RangeKey }) {
  const [{ rows: R, errors }, rs] = await Promise.all([platformSection(range), restSection()]);
  const projects: any[] = rs.data.projects ?? [];
  const deps: Record<string, any[]> = rs.data.deployments ?? {};
  const fn = R.functions ?? [];
  const fsum = (k: string) => fn.reduce((a, r) => a + (r.sum?.[k] ?? 0), 0);
  const audit: any[] = rs.data.audit ?? [];
  const o = R.overviewBytes?.[0];
  return (
    <>
      <Errors errors={[...errors, ...rs.errors]} />
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <Kpi label="Pages 프로젝트" value={fmt.n(projects.length)} />
        <Kpi label="Functions 호출" value={fmt.n(fsum("requests"))} sub={`오류 ${fmt.n(fsum("errors"))}`} />
        <Kpi label="Functions 응답량" value={fmt.bytes(fsum("responseBodySize"))} />
        <Kpi label="R2 버킷" value={fmt.n((R.r2Storage ?? []).length)} sub={fmt.bytes((R.r2Storage ?? []).reduce((a, r) => a + (r.max?.payloadSize ?? 0), 0))} />
        <Kpi label="계정 전체 전송" value={fmt.bytes(o?.sum?.bytes)} sub={`요청 ${fmt.n(o?.sum?.requests)}`} />
        <Kpi label="계정 변경 기록" value={fmt.n((R.audit ?? []).reduce((a, r) => a + count(r), 0))} />
      </div>
      <Box title="Pages 프로젝트 · 최근 배포" source="REST pages/projects · deployments">
        <Table columns={["프로젝트", "도메인", "배포 시각(KST)", "환경", "결과", "트리거 · 커밋"]} mono={[2, 4]} rows={projects.flatMap((p) =>
          (deps[p.name] ?? []).slice(0, 5).map((dep, i) => [
            i === 0 ? <b key="n">{p.name}</b> : "",
            i === 0 ? (p.domains ?? []).join(", ") : "",
            fmt.time(dep.created_on),
            dep.environment,
            dep.latest_stage?.status,
            <span key="m" className="text-ink-soft">{dep.deployment_trigger?.type} · {dep.deployment_trigger?.metadata?.commit_message?.split("\n")[0] ?? dep.short_id}</span>,
          ]))} />
      </Box>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Box title="Pages Functions 호출" source="pagesFunctionsInvocationsAdaptiveGroups" className="lg:col-span-2">
          <LineChart series={[
            { label: "호출", points: (R.functionsSeries ?? []).map((r) => ({ t: r.dimensions.t, v: r.sum?.requests ?? 0 })) },
            { label: "오류", points: (R.functionsSeries ?? []).map((r) => ({ t: r.dimensions.t, v: r.sum?.errors ?? 0 })) },
          ]} />
        </Box>
        <Box title="Functions 스크립트별" source="scriptName · status">
          <Table columns={["스크립트 · 상태", "호출", "CPU P50/P99", "평균 실행"]} mono={[1, 2, 3]} rows={fn.map((r) => [
            `${r.dimensions.scriptName.replace(/^pages-worker--\d+-/, "")} · ${r.dimensions.status}`, fmt.n(r.sum?.requests),
            `${fmt.us(r.quantiles?.cpuTimeP50)} / ${fmt.us(r.quantiles?.cpuTimeP99)}`,
            fmt.us(r.sum?.requests ? r.sum.wallTime / r.sum.requests : null),
          ])} />
        </Box>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Box title="Workers 요청" source="workersOverviewRequestsAdaptiveGroups">
          <BarList rows={(R.workers ?? []).map((r) => ({ label: `${r.dimensions.scriptName} · ${r.dimensions.status}`, value: count(r), sub: fmt.us(r.sum?.cpuTimeUs) }))} />
        </Box>
        <Box title="R2 저장량" source="r2StorageAdaptiveGroups max">
          <BarList rows={(R.r2Storage ?? []).map((r) => ({ label: r.dimensions.bucketName, value: r.max?.payloadSize ?? 0, display: fmt.bytes(r.max?.payloadSize), sub: `객체 ${fmt.n(r.max?.objectCount)}` }))} />
        </Box>
        <Box title="R2 요청" source="r2OperationsAdaptiveGroups">
          <BarList rows={(R.r2Ops ?? []).map((r) => ({ label: `${r.dimensions.bucketName} · ${r.dimensions.actionType}`, value: r.sum?.requests ?? 0, sub: fmt.bytes(r.sum?.responseBytes) }))} />
        </Box>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Box title="계정 변경 종류" source="auditLogsGroups">
          <BarList rows={(R.audit ?? []).map((r) => ({ label: `${r.dimensions.resourceProduct} · ${r.dimensions.actionType}`, value: count(r), sub: `${r.dimensions.actorType} · ${r.dimensions.actionResult}` }))} />
        </Box>
        <Box title="최근 계정 변경 25건" source="REST audit_logs" className="lg:col-span-2">
          <Table columns={["시각(KST)", "행위", "대상", "주체", "결과"]} mono={[0]} rows={audit.map((a) => [
            fmt.time(a.when), a.action?.type, `${a.resource?.type ?? ""} ${a.resource?.id ? String(a.resource.id).slice(0, 12) : ""}`,
            `${a.actor?.type ?? ""} ${a.actor?.ip ?? ""}`, a.action?.result ? "성공" : "실패",
          ])} />
        </Box>
      </div>
    </>
  );
}

export async function DomainAccount() {
  const rs = await restSection();
  const D = rs.data;
  const z = D.zone ?? {};
  const reg = (D.registrar ?? [])[0] ?? {};
  const st: Record<string, any> = Object.fromEntries((D.settings ?? []).map((s: any) => [s.id, s.value]));
  const certs: any[] = D.certs ?? [];
  const rules: any[] = D.emailRules ?? [];
  const now: number = D.fetchedAt;
  const daysLeft = (iso?: string) => (iso ? Math.round((new Date(iso).getTime() - now) / 86400_000) : null);
  return (
    <>
      <Errors errors={rs.errors} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="도메인 만료" value={reg.expires_at ? `D-${daysLeft(reg.expires_at)}` : "-"} sub={reg.expires_at ? `${fmt.date(reg.expires_at)} · 자동 갱신 ${reg.auto_renew ? "on" : "off"}` : undefined} />
        <Kpi label="인증서 만료" value={certs[0]?.certificates?.[0]?.expires_on ? `D-${daysLeft(certs[0].certificates[0].expires_on)}` : "-"} sub={certs.map((c) => `${c.type} ${c.status}`).join(", ")} />
        <Kpi label="존 플랜" value={z.plan?.name ?? "-"} sub={`상태 ${z.status ?? "-"}`} />
        <Kpi label="Web Analytics 사이트" value={fmt.n((D.rumSites ?? []).length)} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Box title="존 · 도메인" source="REST zones · registrar">
          <Pairs items={[
            ["존", z.name], ["활성화", z.activated_on ? fmt.date(z.activated_on) : "-"], ["네임서버", (z.name_servers ?? []).join(", ")],
            ["등록 잠금", String(reg.locked)], ["자동 갱신", String(reg.auto_renew)], ["만료", reg.expires_at ? fmt.date(reg.expires_at) : "-"],
          ]} />
        </Box>
        <Box title="SSL 인증서" source="REST ssl/certificate_packs">
          <Table columns={["종류", "호스트", "상태", "만료"]} mono={[2, 3]} rows={certs.map((c) => [c.type, (c.hosts ?? []).join(", "), c.status, c.certificates?.[0]?.expires_on ? fmt.date(c.certificates[0].expires_on) : "-"])} />
        </Box>
        <Box title="성능 · 캐시 설정" source="REST zone settings">
          <Pairs items={[
            ["HTTP/3", st.http3], ["0-RTT", st["0rtt"]], ["Brotli", st.brotli], ["Early Hints", st.early_hints], ["캐시 수준", st.cache_level],
            ["브라우저 캐시 TTL", st.browser_cache_ttl === 0 ? "원본 따름" : st.browser_cache_ttl], ["개발 모드", st.development_mode], ["Rocket Loader", st.rocket_loader],
            ["IPv6", st.ipv6], ["이메일 난독화", st.email_obfuscation], ["핫링크 보호", st.hotlink_protection],
          ]} />
        </Box>
        <Box title="Web Analytics 사이트" source="REST rum/site_info">
          <Table columns={["호스트", "설치 방식", "site tag"]} mono={[2]} rows={(D.rumSites ?? []).map((s: any) => [s.host ?? "(존 자동) bkan.dev", s.auto_install ? "자동 주입" : "수동 snippet", String(s.site_tag).slice(0, 8)])} />
        </Box>
        <Box title="메일 라우팅" source="REST email/routing">
          <Pairs items={[["상태", `${D.emailRouting?.enabled ? "켜짐" : "꺼짐"} · ${D.emailRouting?.status ?? "-"}`], ["규칙", `${rules.length}개 (${rules.filter((r) => r.enabled).length}개 사용)`]]} />
          <ul className="mt-2 text-xs">{rules.map((r, i) => <li key={i} className="font-mono">{r.enabled ? "on " : "off"} {(r.actions ?? []).map((a: any) => a.type).join(",")} ← {(r.matchers ?? []).map((m: any) => m.type).join(",")}</li>)}</ul>
        </Box>
        <Box title="알림 · 규칙" source="REST alerting · rulesets">
          <Pairs items={[["알림 정책", (D.policies ?? []).map((p: any) => `${p.name}${p.enabled ? "" : "(꺼짐)"}`).join(", ") || "없음"]]} />
          <ul className="mt-2 text-xs">{(D.rulesets ?? []).map((r: any) => <li key={r.id}>{r.phase} · {r.name} <span className="text-ink-soft">({r.kind})</span></li>)}</ul>
        </Box>
      </div>
    </>
  );
}

export async function Internet() {
  const rs = await restSection();
  const rank = rs.data.rank?.details_0 ?? {};
  const ai: Record<string, string> = rs.data.aiBots?.summary_0 ?? {};
  const vb: any[] = rs.data.verifiedBots?.top_0 ?? [];
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Box title="bkan.dev 인터넷 순위" source="Radar ranking/domain">
        <Kpi label="순위 구간" value={rank.bucket ?? "-"} sub={rank.rank ? `${fmt.n(rank.rank)}위` : "상위 20만 밖이면 정확한 순위는 안 나온다"} />
      </Box>
      <Box title="AI 봇 비중 (인터넷 전체, 7일)" source="Radar ai/bots/summary/user_agent" note="내 사이트가 아니라 Cloudflare 네트워크 전체 기준이다.">
        <BarList rows={Object.entries(ai).map(([k, v]) => ({ label: k, value: Number(v), display: `${Number(v).toFixed(1)}%` })).slice(0, 12)} />
      </Box>
      <Box title="검증된 봇 상위 (인터넷 전체, 7일)" source="Radar verified_bots/top/bots">
        <BarList rows={vb.map((b) => ({ label: `${b.botName} · ${b.botCategory}`, value: Number(b.value), display: `${Number(b.value).toFixed(1)}%` }))} />
      </Box>
    </div>
  );
}
