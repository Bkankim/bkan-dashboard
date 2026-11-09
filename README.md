# bkan dashboard

내가 운영하고 쓰는 도구들의 진입점(운영 포털). 맥에서 돌고 테일넷으로만 연다.

## 페이지
- `/` 포털: 제목과 진입 카드만. 카드 목록은 `portal.local.json`(gitignore - 실제 테일넷 주소)에서 요청마다 읽고, 없으면 `portal.example.json`을 보여 준다. JSON만 고치면 다시 빌드하지 않아도 바뀐다.
- `/cloudflare`: Cloudflare API로 받을 수 있는 사이트 데이터 전부를 모으는 페이지. 지금은 와이어프레임(가짜 값)이고 칸은 Web Analytics 데이터셋 3개 몫이다.

카드를 더하려면 `portal.local.json`의 `entries`에 `{name, description, href}`를 넣는다. 공개 리포에는 실제 주소를 커밋하지 않는다(예시 파일만).

## 실행
```sh
pnpm install
pnpm dev            # http://localhost:3000
```
데이터를 붙인 뒤에는 토큰을 서버에만 넣어 띄운다(값을 셸·파일에 펼치지 않는다):
```sh
with-secret cloudflare-analytics-read-token=CF_API_TOKEN env-cloudflare-account-id=CF_ACCOUNT_ID -- pnpm dev
```

## 상시 실행 (맥 + 다른 PC에서 보기)
- 맥 launchd `com.bkan.bkan-dash`가 `pnpm start`를 `127.0.0.1:8791`에 띄운다(KeepAlive, 로그 `~/Library/Logs/bkan-dash.log`). 정의는 `ops/com.bkan.bkan-dash.plist`.
- 토큰은 plist에 없다. `with-secret`이 실행할 때 이 프로세스에만 넣는다.
- 테일넷 노출: `tailscale serve --bg --http=18791 http://127.0.0.1:8791` → 다른 PC에서 `http://my-mac:18791`. https 포트는 11-08 DNS 설정 이후 다른 PC에서 막혀 cct(18790)와 같은 http 방식을 쓴다.
- 고친 뒤 반영: `pnpm build && launchctl kickstart -k gui/501/com.bkan.bkan-dash`.
- 설치: `cp ops/com.bkan.bkan-dash.plist ~/Library/LaunchAgents/ && launchctl bootstrap gui/501 ~/Library/LaunchAgents/com.bkan.bkan-dash.plist`.
- 해제: `launchctl bootout gui/501/com.bkan.bkan-dash && tailscale serve --http=18791 off`.

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
