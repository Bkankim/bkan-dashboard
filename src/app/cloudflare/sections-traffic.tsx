// 트래픽 쪽 섹션: Web Analytics(RUM), 엣지 요청, 365일 추이, 요청 원본 기록
import { BarList, Box, Columns, Errors, fmt, Kpi, LineChart, SplitBar, Table, Waterfall, type Bar } from "@/components/viz";
import { edgeHistory, edgeSection, requestLog, rumSection, type Row } from "@/lib/cf/queries";
import type { RangeKey } from "@/lib/cf/range";

const bars = (rows: Row[] | undefined, label: (r: Row) => string, value: (r: Row) => number, display?: (r: Row) => string, sub?: (r: Row) => string): Bar[] =>
  (rows ?? []).map((r) => ({ label: label(r), value: value(r), display: display?.(r), sub: sub?.(r) }));

const visits = (r: Row) => r.sum?.visits ?? 0;
const count = (r: Row) => r.count ?? 0;
const d = (k: string) => (r: Row) => String(r.dimensions?.[k] ?? "");

export async function WebAnalytics({ range, host }: { range: RangeKey; host: string | null }) {
  const { rows: R, errors } = await rumSection(range, host);
  const t = R.total?.[0];
  const botRows = R.bots ?? [];
  const all = botRows.reduce((a, r) => a + count(r), 0);
  const bot = botRows.filter((r) => r.dimensions?.bot === 1).reduce((a, r) => a + count(r), 0);
  const perf = R.perf?.[0];
  const v = R.vitals?.[0];
  const q = perf?.quantiles ?? {};
  const vitals = ["lcp", "inp", "cls", "fcp", "ttfb"] as const;
  const p75: Record<string, number | undefined> = {
    lcp: v?.quantiles?.largestContentfulPaintP75, inp: v?.quantiles?.interactionToNextPaintP75,
    cls: v?.quantiles?.cumulativeLayoutShiftP75, fcp: v?.quantiles?.firstContentfulPaintP75, ttfb: v?.quantiles?.timeToFirstByteP75,
  };
  return (
    <>
      <Errors errors={errors} />
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <Kpi label="방문" value={fmt.n(t?.sum?.visits)} sub="봇 제외" />
        <Kpi label="페이지뷰" value={fmt.n(t?.count)} />
        <Kpi label="방문당 페이지" value={t?.sum?.visits ? (t.count / t.sum.visits).toFixed(2) : "-"} />
        <Kpi label="봇 비율" value={all ? fmt.pct(bot / all) : "-"} sub={`봇 ${fmt.n(bot)} / 전체 ${fmt.n(all)}`} />
        <Kpi label="페이지 로드 P50" value={fmt.ms(q.pageLoadTimeP50 != null ? q.pageLoadTimeP50 / 1000 : null)} />
        <Kpi label="LCP P75" value={fmt.ms(p75.lcp != null ? p75.lcp / 1000 : null)} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Box title="시간대별 방문 · 페이지뷰" source="rumPageload by time" className="lg:col-span-2">
          <LineChart series={[
            { label: "방문", points: (R.series ?? []).map((r) => ({ t: r.dimensions.t, v: visits(r) })) },
            { label: "페이지뷰", points: (R.series ?? []).map((r) => ({ t: r.dimensions.t, v: count(r) })) },
          ]} />
        </Box>
        <Box title="사이트별 방문" source="requestHost">
          <BarList rows={bars(R.hosts, d("requestHost"), visits)} />
        </Box>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Box title="많이 본 페이지" source="requestHost, requestPath">
          <BarList rows={bars(R.paths, (r) => `${r.dimensions.requestHost}${r.dimensions.requestPath}`, count, undefined, (r) => `방문 ${visits(r)}`)} />
        </Box>
        <Box title="유입 사이트" source="refererHost">
          <BarList rows={bars(R.referers, (r) => r.dimensions.refererHost || "(직접 · 없음)", visits)} />
        </Box>
        <Box title="유입 URL" source="refererHost, refererPath">
          <BarList rows={bars(R.refererPaths, (r) => (r.dimensions.refererHost ? `${r.dimensions.refererHost}${r.dimensions.refererPath}` : "(직접 · 없음)"), visits)} />
        </Box>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Box title="국가" source="countryName"><BarList rows={bars(R.countries, d("countryName"), visits)} /></Box>
        <Box title="브라우저" source="userAgentBrowser"><BarList rows={bars(R.browsers, d("userAgentBrowser"), visits)} /></Box>
        <Box title="OS" source="userAgentOS"><BarList rows={bars(R.os, d("userAgentOS"), visits)} /></Box>
        <Box title="기기 · 엔진 · 접속" source="deviceType · browserEngine · navigationType · deliveryType">
          <div className="flex flex-col gap-4">
            <SplitBar parts={(R.devices ?? []).map((r) => ({ label: r.dimensions.deviceType, value: visits(r) }))} />
            <SplitBar parts={(R.engines ?? []).map((r) => ({ label: r.dimensions.browserEngine, value: visits(r) }))} />
            <SplitBar parts={(R.nav ?? []).map((r) => ({ label: r.dimensions.navigationType, value: count(r) }))} />
            <SplitBar parts={(R.delivery ?? []).map((r) => ({ label: r.dimensions.deliveryType || "(없음)", value: count(r) }))} />
          </div>
        </Box>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Box title="페이지 로드 단계 (평균)" source="rumPerformance avg" note={`표본 ${fmt.n(perf?.count)}건`}>
          <Waterfall steps={[
            ["리다이렉트", "redirectTime"], ["DNS", "dnsTime"], ["연결", "connectionTime"], ["TLS", "tlsTime"], ["요청", "requestTime"],
            ["응답", "responseTime"], ["첫 그림(FP)", "firstPaint"], ["첫 콘텐츠(FCP)", "firstContentfulPaint"], ["렌더", "pageRenderTime"], ["load 이벤트", "loadEventTime"],
          ].map(([label, k]) => ({ label, ms: (perf?.avg?.[k] ?? 0) / 1000 }))} />
        </Box>
        <Box title="페이지 로드 시간 분포" source="pageLoadTime P25~P99.9">
          <Columns format={(x) => fmt.ms(x / 1000)} items={["P25", "P50", "P75", "P90", "P95", "P99", "P999"].map((p) => ({ label: p === "P999" ? "P99.9" : p, value: q[`pageLoadTime${p}`] ?? null }))} />
        </Box>
        <Box title="사이트별 로드 시간" source="pageLoadTime P50 / P95 by host">
          <BarList rows={bars(R.perfByHost, d("requestHost"), (r) => r.quantiles?.pageLoadTimeP50 ?? 0, (r) => `${fmt.ms((r.quantiles?.pageLoadTimeP50 ?? 0) / 1000)} / ${fmt.ms((r.quantiles?.pageLoadTimeP95 ?? 0) / 1000)}`)} />
        </Box>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Box title="Core Web Vitals (좋음 · 개선 필요 · 나쁨)" source="rumWebVitals sum" className="lg:col-span-2" note={`표본 ${fmt.n(v?.count)}건, 오른쪽 값은 P75`}>
          <div className="flex flex-col gap-3">
            {vitals.map((m) => (
              <div key={m} className="grid grid-cols-[3.5rem_minmax(0,1fr)_4.5rem] gap-3 items-center text-xs">
                <span className="font-semibold uppercase">{m}</span>
                <SplitBar parts={[
                  { label: "좋음", value: v?.sum?.[`${m}Good`] ?? 0 },
                  { label: "개선 필요", value: v?.sum?.[`${m}NeedsImprovement`] ?? 0 },
                  { label: "나쁨", value: v?.sum?.[`${m}Poor`] ?? 0 },
                ]} />
                <span className="font-mono text-right">{m === "cls" ? (p75.cls ?? 0).toFixed(3) : fmt.ms(p75[m] != null ? p75[m]! / 1000 : null)}</span>
              </div>
            ))}
          </div>
        </Box>
        <Box title="INP · LCP 세부 (평균)" source="rumWebVitals avg">
          <Waterfall steps={[
            ["INP 입력 지연", "inpInputDelay"], ["INP 처리", "inpProcessingDuration"], ["INP 화면 반영", "inpPresentationDelay"],
            ["LCP 리소스 대기", "lcpResourceLoadDelay"], ["LCP 리소스 로드", "lcpResourceLoadTime"], ["LCP 렌더 지연", "lcpElementRenderDelay"],
          ].map(([label, k]) => ({ label, ms: (v?.avg?.[k] ?? 0) / 1000 }))} />
        </Box>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(["largestContentfulPaint", "cumulativeLayoutShift", "interactionToNextPaint"] as const).map((m) => (
          <Box key={m} title={`${{ largestContentfulPaint: "LCP", cumulativeLayoutShift: "CLS", interactionToNextPaint: "INP" }[m]} 원인 요소`} source={`${m}Element`}>
            <Table columns={["요소 · 페이지", "표본", "P75"]} mono={[1, 2]} rows={(R[`el_${m}`] ?? []).map((r) => [
              <span key="e"><code className="font-mono">{r.dimensions[`${m}Element`] || "(없음)"}</code><br /><span className="text-ink-soft">{r.dimensions[`${m}Path`]}</span></span>,
              fmt.n(r.count),
              m === "cumulativeLayoutShift" ? (r.quantiles?.cumulativeLayoutShiftP75 ?? 0).toFixed(3) : fmt.ms((r.quantiles?.[`${m}P75`] ?? 0) / 1000),
            ])} />
          </Box>
        ))}
      </div>
    </>
  );
}

export async function Edge({ range, host }: { range: RangeKey; host: string | null }) {
  if (host === "lab.bkan.dev") return <p className="text-xs">lab.bkan.dev는 DNS only라 Cloudflare 엣지를 거치지 않는다. 이 섹션에 잡히지 않는다.</p>;
  const { rows: R, errors } = await edgeSection(range, host);
  const t = R.total?.[0];
  const cached = (R.cache ?? []).filter((r) => ["hit", "stale", "revalidated", "updating"].includes(r.dimensions.cacheStatus)).reduce((a, r) => a + count(r), 0);
  const o = R.origin?.[0];
  return (
    <>
      <Errors errors={errors} />
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <Kpi label="요청" value={fmt.n(t?.count)} />
        <Kpi label="보낸 바이트" value={fmt.bytes(t?.sum?.edgeResponseBytes)} sub={`받은 ${fmt.bytes(t?.sum?.edgeRequestBytes)}`} />
        <Kpi label="방문(엣지 기준)" value={fmt.n(t?.sum?.visits)} />
        <Kpi label="캐시 적중" value={t?.count ? fmt.pct(cached / t.count) : "-"} sub="hit·stale·revalidated·updating" />
        <Kpi label="4xx 비율" value={fmt.pct(t?.ratio?.status4xx, 2)} />
        <Kpi label="5xx 비율" value={fmt.pct(t?.ratio?.status5xx, 2)} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Box title="시간대별 요청 · 바이트" source="httpRequestsAdaptiveGroups by time" className="lg:col-span-2">
          <LineChart series={[{ label: "요청", points: (R.series ?? []).map((r) => ({ t: r.dimensions.t, v: count(r) })) }]} />
          <LineChart height={90} format={fmt.bytes} series={[{ label: "보낸 바이트", points: (R.series ?? []).map((r) => ({ t: r.dimensions.t, v: r.sum?.edgeResponseBytes ?? 0 })) }]} />
        </Box>
        <Box title="호스트별 요청" source="clientRequestHTTPHost">
          <BarList rows={bars(R.hosts, d("clientRequestHTTPHost"), count, undefined, (r) => fmt.bytes(r.sum?.edgeResponseBytes))} />
        </Box>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Box title="많이 요청된 경로" source="clientRequestHTTPHost, clientRequestPath" className="xl:col-span-2">
          <BarList rows={bars(R.paths, (r) => `${r.dimensions.clientRequestHTTPHost}${r.dimensions.clientRequestPath}`, count, undefined, (r) => fmt.bytes(r.sum?.edgeResponseBytes))} />
        </Box>
        <Box title="방문자 IP" source="clientIP (Free 플랜에서 읽힘)" note="IP는 개인정보다. 이 화면은 맥·테일넷 안에서만 열리고 따로 저장하지 않는다.">
          <BarList rows={bars(R.ips, d("clientIP"), count, undefined, d("clientCountryName"))} />
        </Box>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Box title="상태 코드" source="edgeResponseStatus"><BarList rows={bars(R.status, d("edgeResponseStatus"), count)} /></Box>
        <Box title="캐시 상태" source="cacheStatus"><BarList rows={bars(R.cache, d("cacheStatus"), count)} /></Box>
        <Box title="국가" source="clientCountryName"><BarList rows={bars(R.countries, d("clientCountryName"), count)} /></Box>
        <Box title="검증된 봇 분류" source="verifiedBotCategory" note="빈 값 = 검증된 봇 아님(사람 또는 미분류)"><BarList rows={bars(R.bots, (r) => r.dimensions.verifiedBotCategory || "(사람 · 미분류)", count)} /></Box>
        <Box title="브라우저" source="userAgentBrowser"><BarList rows={bars(R.browsers, d("userAgentBrowser"), count)} /></Box>
        <Box title="OS" source="userAgentOS"><BarList rows={bars(R.os, d("userAgentOS"), count)} /></Box>
        <Box title="콘텐츠 종류" source="edgeResponseContentTypeName"><BarList rows={bars(R.contentTypes, d("edgeResponseContentTypeName"), count, undefined, (r) => fmt.bytes(r.sum?.edgeResponseBytes))} /></Box>
        <Box title="데이터센터(콜로)" source="coloCode"><BarList rows={bars(R.colos, d("coloCode"), count)} /></Box>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Box title="기기" source="clientDeviceType"><SplitBar parts={(R.devices ?? []).map((r) => ({ label: r.dimensions.clientDeviceType, value: count(r) }))} /></Box>
        <Box title="메서드 · 프로토콜 · TLS" source="method · HTTP protocol · SSL protocol">
          <div className="flex flex-col gap-4">
            <SplitBar parts={(R.methods ?? []).map((r) => ({ label: r.dimensions.clientRequestHTTPMethodName, value: count(r) }))} />
            <SplitBar parts={(R.protocols ?? []).map((r) => ({ label: r.dimensions.clientRequestHTTPProtocol, value: count(r) }))} />
            <SplitBar parts={(R.tls ?? []).map((r) => ({ label: r.dimensions.clientSSLProtocol || "(평문)", value: count(r) }))} />
          </div>
        </Box>
        <Box title="보안 처리 · 요청 출처" source="securityAction · securitySource · requestSource">
          <BarList rows={bars(R.securityActions, (r) => `${r.dimensions.securityAction || "(없음)"} · ${r.dimensions.securitySource || "-"}`, count)} />
          <div className="mt-3"><SplitBar parts={(R.requestSource ?? []).map((r) => ({ label: r.dimensions.requestSource, value: count(r) }))} /></div>
        </Box>
        <Box title="원본(Pages) 응답 시간" source="originResponseDurationMs">
          <Columns items={[["P50", "originResponseDurationMsP50"], ["P95", "originResponseDurationMsP95"], ["P99", "originResponseDurationMsP99"]].map(([l, k]) => ({ label: l, value: o?.quantiles?.[k] ?? null }))} />
          <p className="text-[11px] mt-2">평균 TCP {fmt.ms(o?.avg?.originTcpHandshakeDurationMs)} · TLS {fmt.ms(o?.avg?.originTlsHandshakeDurationMs)}</p>
        </Box>
      </div>
      <Box title="User-Agent 원문 상위" source="userAgent">
        <BarList rows={bars(R.userAgents, d("userAgent"), count)} />
      </Box>
    </>
  );
}

export async function EdgeHistory() {
  const { rows: R, errors } = await edgeHistory(null);
  const days = R.days ?? [];
  const sum = (k: string) => days.reduce((a, r) => a + (r.sum?.[k] ?? 0), 0);
  const first = days[0]?.dimensions?.date;
  return (
    <>
      <Errors errors={errors} />
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <Kpi label="요청" value={fmt.n(sum("requests"))} sub={first ? `${first}부터 ${days.length}일` : undefined} />
        <Kpi label="페이지뷰" value={fmt.n(sum("pageViews"))} />
        <Kpi label="보낸 바이트" value={fmt.bytes(sum("bytes"))} />
        <Kpi label="캐시된 바이트" value={fmt.bytes(sum("cachedBytes"))} />
        <Kpi label="위협(차단·챌린지)" value={fmt.n(sum("threats"))} />
        <Kpi label="HTTPS 비율" value={sum("requests") ? fmt.pct(sum("encryptedRequests") / sum("requests")) : "-"} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Box title="일별 요청 · 페이지뷰" source="httpRequests1dGroups (보관 365일)">
          <LineChart series={[
            { label: "요청", points: days.map((r) => ({ t: r.dimensions.date, v: r.sum.requests })) },
            { label: "페이지뷰", points: days.map((r) => ({ t: r.dimensions.date, v: r.sum.pageViews })) },
          ]} />
        </Box>
        <Box title="일별 순방문자 · 위협" source="uniq.uniques · sum.threats" note="순방문자는 하루 단위 고유 IP 수다.">
          <LineChart series={[
            { label: "순방문자", points: days.map((r) => ({ t: r.dimensions.date, v: r.uniq?.uniques ?? 0 })) },
            { label: "위협", points: days.map((r) => ({ t: r.dimensions.date, v: r.sum.threats })) },
          ]} />
        </Box>
      </div>
      <Box title="일별 전송량" source="sum.bytes · sum.cachedBytes">
        <LineChart height={120} format={fmt.bytes} series={[
          { label: "보낸 바이트", points: days.map((r) => ({ t: r.dimensions.date, v: r.sum.bytes })) },
          { label: "캐시된 바이트", points: days.map((r) => ({ t: r.dimensions.date, v: r.sum.cachedBytes })) },
        ]} />
      </Box>
    </>
  );
}

export async function RequestLog({ range, host }: { range: RangeKey; host: string | null }) {
  if (host === "lab.bkan.dev") return <p className="text-xs">lab.bkan.dev는 DNS only라 요청 기록이 없다.</p>;
  const { rows: R, errors } = await requestLog(range, host);
  return (
    <>
      <Errors errors={errors} />
      <Box title="최근 요청 100건" source="httpRequestsAdaptive (샘플링된 원본 기록)" note="Cloudflare가 표본으로 남긴 기록이라 모든 요청이 다 있지는 않다.">
        <Table
          columns={["시각(KST)", "IP", "국가 · ASN", "요청", "상태", "캐시", "브라우저 · 봇", "보안"]}
          mono={[0, 1, 4]}
          rows={(R.log ?? []).map((r) => [
            fmt.time(r.datetime),
            r.clientIP,
            `${r.clientCountryName} · ${r.clientASNDescription ?? ""}`,
            <span key="q">{r.clientRequestHTTPMethodName} {r.clientRequestHTTPHost}{r.clientRequestPath}{r.clientRequestQuery ? <span className="text-ink-soft">{r.clientRequestQuery}</span> : null}</span>,
            r.edgeResponseStatus,
            r.cacheStatus,
            <span key="b" title={r.userAgent}>{r.userAgentBrowser} / {r.userAgentOS}{r.verifiedBotCategory ? ` · ${r.verifiedBotCategory}` : ""}</span>,
            r.securityAction || "",
          ])}
        />
      </Box>
    </>
  );
}

