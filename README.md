# bkan dashboard

bkan.dev·portfolio.bkan.dev·blog.bkan.dev·lab.bkan.dev 방문자 통계를 보는 로컬 전용 대시보드.
지금은 와이어프레임(메인 페이지, 가짜 값)까지다.

## 실행
```sh
pnpm install
pnpm dev            # http://localhost:3000
```
데이터를 붙인 뒤에는 토큰을 서버에만 넣어 띄운다(값을 셸·파일에 펼치지 않는다):
```sh
with-secret cloudflare-analytics-read-token=CF_API_TOKEN env-cloudflare-account-id=CF_ACCOUNT_ID -- pnpm dev
```

## 데이터
Cloudflare GraphQL Analytics API(`https://api.cloudflare.com/client/v4/graphql`), account 범위.
토큰 권한은 Account Analytics: Read 하나(`~/.secrets/cloudflare-analytics-read-token.txt`, INDEX 등록).

| 데이터셋 | 숫자 | 나눠 보는 기준 |
|---|---|---|
| `rumPageloadEventsAdaptiveGroups` | `count`(페이지뷰), `sum.visits` | requestHost·requestPath·refererHost·refererPath·countryName·deviceType·userAgentBrowser·userAgentOS·browserEngine·navigationType·deliveryType·bot·date·datetimeHour 등 |
| `rumPerformanceEventsAdaptiveGroups` | `avg.*`·`quantiles.*P25~P999` (dns·tls·connection·request·response·firstPaint·FCP·pageLoad·pageRender·loadEvent) | 위와 같음 |
| `rumWebVitalsEventsAdaptiveGroups` | `sum.{lcp,inp,cls,fcp,ttfb}{Good,NeedsImprovement,Poor,Total}`, `avg`·`quantiles`(LCP·INP·CLS·FCP·TTFB·INP 세부) | 위 + LCP·CLS·INP 원인 요소·경로 |

- 사이트 구분: `siteTag`(bkan.dev 존 사이트, lab.bkan.dev 사이트) + `requestHost`.
- 봇: `filter: { bot: 0 }`로 뺀다(대시보드 기본값과 같다). 헤드리스 브라우저 방문은 봇으로 잡힌다.
- 한도: 사용자당 GraphQL 5분 300회.
- 2026-11-10 실측: 최근 24시간 호스트별 조회가 바로 동작했다.

## 화면 규칙 (와이어프레임)
흰 바탕, 검은 선만. 색 대신 빗금·점선으로 구분한다. 칸마다 작은 글씨로 쓸 API 필드를 적어 두었다(`src/app/page.tsx`).
