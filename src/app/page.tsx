// bkan dashboard 메인 - 와이어프레임(가짜 값). 칸 배치와 칸마다 쓸 API 필드만 정한다.
// 데이터: Cloudflare GraphQL Analytics API, account 범위 데이터셋 3개
//   rumPageloadEventsAdaptiveGroups  방문·페이지뷰
//   rumPerformanceEventsAdaptiveGroups  로드 단계 시간(평균·백분위)
//   rumWebVitalsEventsAdaptiveGroups  Core Web Vitals(좋음/개선/나쁨, 원인 요소)

import {
  BarList,
  Box,
  Kpi,
  LineChart,
  Placeholder,
  Quantiles,
  SplitBar,
  Table,
  VitalLegend,
  VitalRow,
  Waterfall,
} from "@/components/wire";

const SITES = ["전체", "bkan.dev", "portfolio.bkan.dev", "blog.bkan.dev", "lab.bkan.dev"];
const RANGES = ["30분", "24시간", "7일", "30일"];

const PL = "rumPageload";
const PF = "rumPerformance";
const WV = "rumWebVitals";

export default function Home() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 flex flex-col gap-6">
      {/* 머리: 이름, 기간, 사이트 필터 */}
      <header className="flex flex-col gap-4 border-b border-ink pb-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">bkan dashboard</h1>
            <p className="text-xs mt-1">와이어프레임 - 값은 모두 가짜(000)다.</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="font-mono">갱신 00:00:00</span>
            <button type="button" className="border border-ink px-3 py-1.5">새로고침</button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="사이트" className="flex flex-wrap gap-2">
            {SITES.map((s, i) => (
              <button
                key={s}
                type="button"
                className={`border border-ink px-3 py-1.5 text-xs ${i === 0 ? "bg-ink text-paper" : ""}`}
              >
                {s}
              </button>
            ))}
          </nav>
          <div role="group" aria-label="기간" className="flex border border-ink text-xs">
            {RANGES.map((r, i) => (
              <button
                key={r}
                type="button"
                className={`px-3 py-1.5 ${i > 0 ? "border-l border-ink" : ""} ${i === 1 ? "bg-ink text-paper" : ""}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" defaultChecked className="accent-black" /> 봇 제외 (filter bot: 0)
        </label>
      </header>

      {/* 핵심 숫자 */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <Kpi label="방문" source={`${PL} sum.visits`} />
        <Kpi label="페이지뷰" source={`${PL} count`} />
        <Kpi label="방문당 페이지" source="count / sum.visits" />
        <Kpi label="봇 비율" source={`${PL} count by bot`} unit="%" />
        <Kpi label="페이지 로드 P50" source={`${PF} quantiles.pageLoadTimeP50`} unit="ms" />
        <Kpi label="LCP P75" source={`${WV} quantiles.largestContentfulPaintP75`} unit="ms" />
      </div>

      {/* 추이 + 사이트별 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Box
          title="시간대별 방문 · 페이지뷰"
          source={`${PL} by datetimeHour | date`}
          className="lg:col-span-2 min-h-72"
        >
          <LineChart series={["방문", "페이지뷰"]} />
        </Box>
        <Box title="사이트별" source={`${PL} by requestHost`}>
          <BarList rows={SITES.slice(1)} />
        </Box>
      </div>

      {/* 무엇을 봤나, 어디서 왔나 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Box title="많이 본 페이지" source={`${PL} by requestHost, requestPath`}>
          <Table columns={["경로", "페이지뷰", "방문"]} rows={6} />
        </Box>
        <Box title="유입 사이트" source={`${PL} by refererHost`}>
          <BarList rows={["(직접)", "google.com", "linkedin.com", "github.com", "kakao", "naver.com"]} />
        </Box>
        <Box title="유입 경로 상세" source={`${PL} by refererHost, refererPath`}>
          <Table columns={["유입 URL", "방문"]} rows={6} />
        </Box>
      </div>

      {/* 누가 왔나 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Box title="국가" source={`${PL} by countryName`} className="lg:col-span-2 min-h-64">
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4 h-full">
            <Placeholder label="세계 지도" />
            <BarList rows={["KR", "US", "JP", "DE", "SG"]} />
          </div>
        </Box>
        <Box title="기기 · 접속 방식" source={`${PL} by deviceType | navigationType | deliveryType`}>
          <div className="flex flex-col gap-5">
            <SplitBar parts={[{ label: "desktop", pct: 58 }, { label: "mobile", pct: 36 }, { label: "tablet", pct: 6 }]} />
            <SplitBar parts={[{ label: "navigate", pct: 70 }, { label: "reload", pct: 18 }, { label: "back_forward", pct: 12 }]} />
          </div>
        </Box>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Box title="브라우저" source={`${PL} by userAgentBrowser, browserVersion`}>
          <BarList rows={["Chrome", "Safari", "Edge", "Firefox", "Samsung Internet"]} />
        </Box>
        <Box title="OS" source={`${PL} by userAgentOS, osVersion`}>
          <BarList rows={["macOS", "Windows", "iOS", "Android", "Linux"]} />
        </Box>
        <Box title="엔진" source={`${PL} by browserEngine`}>
          <BarList rows={["Blink", "WebKit", "Gecko"]} />
        </Box>
      </div>

      {/* 성능 */}
      <h2 className="text-lg font-semibold border-b border-ink pb-2 mt-2">성능</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Box title="페이지 로드 단계 (평균)" source={`${PF} avg.{dnsTime, tlsTime, connectionTime, requestTime, responseTime, firstPaint, ...}`}>
          <Waterfall
            steps={["리다이렉트", "DNS", "연결", "TLS", "요청", "응답", "첫 그림(FP)", "첫 콘텐츠(FCP)", "렌더", "load 이벤트"]}
          />
        </Box>
        <Box title="페이지 로드 시간 분포" source={`${PF} quantiles.pageLoadTimeP25 ~ P999`}>
          <Quantiles />
        </Box>
      </div>

      {/* Core Web Vitals */}
      <h2 className="text-lg font-semibold border-b border-ink pb-2 mt-2">Core Web Vitals</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Box title="좋음 · 개선 필요 · 나쁨" source={`${WV} sum.{lcp,inp,cls,fcp,ttfb}{Good,NeedsImprovement,Poor}`} className="lg:col-span-2">
          <div className="flex flex-col gap-3">
            <VitalRow name="LCP" source="lcpGood / lcpNeedsImprovement / lcpPoor" />
            <VitalRow name="INP" source="inpGood / inpNeedsImprovement / inpPoor" />
            <VitalRow name="CLS" source="clsGood / clsNeedsImprovement / clsPoor" />
            <VitalRow name="FCP" source="fcpGood / fcpNeedsImprovement / fcpPoor" />
            <VitalRow name="TTFB" source="ttfbGood / ttfbNeedsImprovement / ttfbPoor" />
            <VitalLegend />
          </div>
        </Box>
        <Box title="INP 세부 (평균)" source={`${WV} avg.{inpInputDelay, inpProcessingDuration, inpPresentationDelay}`}>
          <Waterfall steps={["입력 지연", "처리", "화면 반영"]} />
        </Box>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Box title="LCP 원인 요소" source={`${WV} by largestContentfulPaintElement, largestContentfulPaintPath`}>
          <Table columns={["요소 · 페이지", "P75"]} rows={4} />
        </Box>
        <Box title="CLS 원인 요소" source={`${WV} by cumulativeLayoutShiftElement, cumulativeLayoutShiftPath`}>
          <Table columns={["요소 · 페이지", "P75"]} rows={4} />
        </Box>
        <Box title="INP 원인 요소" source={`${WV} by interactionToNextPaintElement, interactionToNextPaintName`}>
          <Table columns={["요소 · 이벤트", "P75"]} rows={4} />
        </Box>
      </div>

      <footer className="border-t border-ink pt-3 text-[11px] flex flex-wrap justify-between gap-2">
        <span>데이터: Cloudflare Web Analytics (GraphQL Analytics API, account 범위)</span>
        <span className="font-mono">로컬 전용 · 토큰은 서버에서만</span>
      </footer>
    </div>
  );
}
