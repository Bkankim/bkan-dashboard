# bkan dashboard

내가 운영하고 쓰는 도구들의 진입점(운영 포털). 맥에서 돌고 테일넷으로만 연다.

## 페이지
- `/` 포털: 제목과 진입 카드만. 카드 목록은 `portal.local.json`(gitignore - 실제 테일넷 주소)에서 요청마다 읽고, 없으면 `portal.example.json`을 보여 준다. JSON만 고치면 다시 빌드하지 않아도 바뀐다.
- `/cloudflare`: Cloudflare API로 받을 수 있는 사이트 데이터 전부(실데이터). 방문(Web Analytics) · 엣지 트래픽 · 365일 추이 · 요청 기록 · 보안 · DNS · 플랫폼(Pages·Functions·Workers·R2·감사 로그) · 도메인·계정 · 인터넷(Radar). `?range=30m|24h|7d|30d&host=<사이트>`. 무엇이 있고 무엇이 플랜에 막혔는지는 `docs/research/cloudflare-data.md`.

카드를 더하려면 `portal.local.json`의 `entries`에 `{name, description, href}`를 넣는다. 공개 리포에는 실제 주소를 커밋하지 않는다(예시 파일만).

## 실행
```sh
pnpm install
pnpm dev            # http://localhost:3000
```
데이터를 붙인 뒤에는 토큰을 서버에만 넣어 띄운다(값을 셸·파일에 펼치지 않는다):
```sh
with-secret cloudflare-read-all-token=CF_API_TOKEN env-cloudflare-account-id=CF_ACCOUNT_ID -- pnpm dev
```

## 상시 실행 (맥 + 다른 PC에서 보기)
- 맥 launchd `com.bkan.bkan-dash`가 `pnpm start`를 `127.0.0.1:8791`에 띄운다(KeepAlive, 로그 `~/Library/Logs/bkan-dash.log`). 정의는 `ops/com.bkan.bkan-dash.plist`.
- 토큰은 plist에 없다. `with-secret`이 실행할 때 이 프로세스에만 넣는다.
- 테일넷 노출: `tailscale serve --bg --http=18791 http://127.0.0.1:8791` → 다른 PC에서 `http://my-mac:18791`. https 포트는 11-08 DNS 설정 이후 다른 PC에서 막혀 cct(18790)와 같은 http 방식을 쓴다.
- 고친 뒤 반영: `pnpm build && launchctl kickstart -k gui/501/com.bkan.bkan-dash`.
- 설치: `sed "s|/Users/you|$HOME|g" ops/com.bkan.bkan-dash.plist > ~/Library/LaunchAgents/com.bkan.bkan-dash.plist && launchctl bootstrap gui/501 ~/Library/LaunchAgents/com.bkan.bkan-dash.plist`.
- 해제: `launchctl bootout gui/501/com.bkan.bkan-dash && tailscale serve --http=18791 off`.

## 데이터
Cloudflare GraphQL Analytics API(`https://api.cloudflare.com/client/v4/graphql`)의 account·zone 범위와 REST API(DNS·Pages·R2·감사 로그·Radar 등, `src/lib/cf/queries.ts`).
토큰은 읽기 전용 `bkan-dashboard-read-all`(Read 권한 182개, API 토큰·결제·시크릿 저장소 제외, INDEX 이름 `cloudflare-read-all-token`). 좁히는 일은 "한계와 다음"에 있다.
- 값은 60초마다 새로 받고, 하루 동안은 낡은 값을 먼저 보여 준다(`use cache` + `cacheLife`). 빈 캐시에서 7일 범위 첫 요청은 2초 안팎이다(2026-11-10 측정).
- `CF_TIMING=1`을 주고 띄우면 호출마다 걸린 시간·크기·이벤트 루프 지연이 로그에 `[cf-timing]`으로 남는다.

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

## 구조
Next.js 16 App Router 하나다. `cacheComponents`가 켜져 있어 제목은 빌드 때 그리고, 데이터는 요청 때 받아 `Suspense` 뒤에서 채운다.
- `src/lib/portal.ts`: 포털 카드 목록을 요청마다 파일에서 읽는다(`connection()`).
- `src/lib/cf/client.ts`: Cloudflare 호출 한 곳. 서버 전용(`server-only`)이고 토큰은 환경 변수 `CF_API_TOKEN`·`CF_ACCOUNT_ID`에서만 읽는다.
- `src/lib/cf/queries.ts`: 섹션별 질의와 캐시 수명. `src/app/cloudflare/`의 섹션 컴포넌트가 이걸 부르고, `src/components/viz.tsx`의 상자·표·차트로 그린다.
- `ops/`: 맥 launchd 정의("상시 실행"). `docs/research/`: Cloudflare API로 무엇을 받을 수 있는지 조사한 원자료와 정리.

## 상태
2026-11-13 기준 맥 launchd로 상시 실행 중이다(`launchctl print`로 running 확인).<br>
2026-11-10에 정한 다음 순서: `/cloudflare`에서 뺄 섹션·칸을 고르고, 그에 맞춰 토큰 권한을 좁히고, 꾸미기는 그 뒤에 한다.

## 결정과 절충
- **Cloudflare 호출은 Next가 바꿔 끼운 전역 `fetch` 대신 `node:https`로 한다(2026-11-10).** 같은 동시 호출이 순수 Node fetch로 1.1초, Next fetch로 5~6초였다(응답이 서로 줄을 섬). 캐시는 `use cache`가 맡으니 Next fetch의 캐시 기능은 포기했다.
- **GraphQL 별칭은 6개씩 나눠 병렬로 보낸다(2026-11-10).** 21개를 한 질의에 묶으면 Cloudflare가 차례로 처리해 4초 걸렸다. 대신 호출 수가 늘어 한도(5분 300회)에 그만큼 가까워진다.
- **실제 테일넷 주소는 리포에 두지 않는다.** 공개 리포라서 `portal.local.json`(gitignore)에만 두고, 없으면 `portal.example.json`을 보여 준다. 새 장비에서는 예시 카드가 먼저 보인다.

## 한계와 다음
- 테일넷 안에서만 열린다. 맥이 꺼지면 같이 멈춘다.
- 토큰 `bkan-dashboard-read-all`은 Read 권한 182개로 넓다. `/cloudflare`에 남길 섹션을 정한 뒤 쓰는 권한만 남긴다.
- `pnpm build`가 `src/lib/portal.ts`의 `path.join(process.cwd(), ...)` 때문에 리포 전체를 서버 파일로 추적한다는 경고를 낸다(2026-11-13 확인). 빌드는 통과한다.
