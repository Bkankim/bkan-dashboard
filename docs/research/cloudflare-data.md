# Cloudflare에서 끌어올 수 있는 데이터 (2026-11-10 실측)

계정 1개, 존 1개(bkan.dev, Free Website 플랜) 기준.
추측이 아니라 API를 직접 호출해 확인한 결과다. 원자료는 같은 폴더의 JSON 파일이다.

- `graphql-datasets.json`: 스키마에 있는 데이터셋 전체(계정 257, 존 63)
- `graphql-settings.json`: 그중 이 계정·존에서 켜진 것과 보관 기간(`notOlderThan`), 한 번에 조회할 수 있는 폭(`maxDuration`)
- `graphql-probe.json`: 켜진 데이터셋마다 최근 7일 실제 데이터가 있는지 조회한 결과
- `graphql-fields.json`: 주요 데이터셋의 필드를 하나씩 조회해 Free 플랜에서 읽을 수 있는지(ok/denied) 판정한 결과
- `rest-probe.json`: REST 읽기 엔드포인트 호출 결과

## 조사 방법
1. 스키마 조회로 데이터셋 전체 목록을 뽑는다.
2. `settings` 노드로 켜진 것과 보관 기간을 본다(켜짐 ≠ 데이터 있음).
3. 켜진 것마다 최근 7일 질의를 보내 데이터가 실제로 있는지 본다.
4. 데이터가 있는 주요 데이터셋은 필드를 하나씩 질의해 플랜 제한(denied)을 가린다.
5. REST는 읽기 엔드포인트를 하나씩 호출한다.

토큰: `bkan-dashboard-read-all`(Read 권한 182개, API 토큰·결제·시크릿 저장소·Access 서비스 토큰 제외).

## 데이터가 실제로 있는 GraphQL 데이터셋

| 데이터셋 | 범위 | 보관 | 내용 |
|---|---|---|---|
| `rumPageloadEventsAdaptiveGroups` 외 RUM 3종 | 계정 | 184일 | Web Analytics 방문·성능·Web Vitals (lab 포함 4개 사이트) |
| `httpRequestsAdaptiveGroups` | 존 | 31일 | 프록시를 거친 요청 집계. clientIP·국가·경로·상태·캐시·봇 분류·UA 등 102개 필드 ok |
| `httpRequestsAdaptive` | 존 | 31일 | **요청 원본 기록**(샘플). clientIP·ASN·경로·쿼리·상태·캐시·UA·rayName |
| `httpRequests1dGroups` | 존 | **365일** | 일별 요청·바이트·캐시·위협·순방문자(uniques)·페이지뷰 |
| `httpRequests1hGroups` | 존 | 3일 | 시간별 요청 |
| `httpRequestsOverviewAdaptiveGroups` | 계정·존 | 32일 | 전송 바이트 개요 |
| `firewallEventsAdaptive` | 존 | 31일 | **보안 이벤트 원본**. action·source(linkMaze 등)·clientIP·경로·UA·ruleId |
| `firewallEventsAdaptiveByTimeGroups` | 존 | 31일 | 보안 이벤트 시간별 개수 |
| `dnsAnalyticsAdaptiveGroups` | 계정·존 | 31일 | DNS 질의. queryName·queryType·responseCode·coloName·sourceIP 등 48개 필드 ok |
| `pagesFunctionsInvocationsAdaptiveGroups` | 계정 | 90일 | Pages Functions(lab 영상 Range 미들웨어) 호출·오류·CPU·시간 |
| `workersOverviewRequestsAdaptiveGroups` / `DataAdaptiveGroups` | 계정 | 90일 | Workers 요청·CPU 개요 |
| `r2StorageAdaptiveGroups` / `r2OperationsAdaptiveGroups` | 계정 | 90일 | R2 버킷 2개(bkan-storage, ourfolio-images) 저장량·요청 |
| `auditLogsGroups` | 계정 | - | 계정 변경 기록(누가·무엇을·언제) |
| `apiGatewayMatchedSessionIDsPerEndpoint...` | 존 | 31일 | API Gateway 세션 매칭 개수(뜻은 추가 확인 필요) |

켜져 있지만 데이터가 없는 것: KV·D1·Queues·Durable Objects·Vectorize·Email Routing·DMARC·Markdown for Agents 등(쓰지 않는 제품).

## Free 플랜에서 막힌 필드 (denied)
- 봇 점수·봇 탐지 ID(`botScore`, `botManagementDecision`, `ja3Hash`, `ja4`)
- WAF 공격 점수(`wafAttackScore` 등)
- **리퍼러**(`clientRequestReferer`, `clientRefererHost`) - 엣지 요청 쪽. 리퍼러는 Web Analytics(RUM)와 보안 이벤트 쪽에서는 읽힌다.
- 엣지 TTFB·DNS 응답 시간(`edgeTimeToFirstByteMs`)
- 원본 기록의 `coloCode`·`originIP`(집계 쪽 `coloCode`는 ok)
- `firewallEventsAdaptiveGroups`(집계) - 원본 기록을 받아 직접 센다.

## REST로 읽히는 것
| 항목 | 결과 |
|---|---|
| Pages 프로젝트·배포 이력 | 4개(bkan-dev, bkan-portfolio, bkan-blog, bkan-lab). bkan-blog 최신 배포가 failure(11-06) |
| 도메인 등록(Registrar) | bkan.dev 만료 2027-03-04, 자동 갱신 켜짐, 잠금 켜짐 |
| SSL 인증서 | universal(bkan.dev, *.bkan.dev) active, 만료 2027-01-24 |
| Security Center 인사이트 | 설정 지적 목록(심각도·종류·대상). 내용은 공개 리포에 적지 않고 대시보드에서만 본다 |
| 봇 관리 설정 | Bot Fight Mode·크롤러 보호·AI 봇 차단 켜짐 여부 |
| 존 설정 56개 | SSL·TLS·HTTP/3·캐시·압축 등 설정값 |
| DNS 레코드 | 22개(A·CNAME·MX·TXT), 프록시 9개 |
| DNSSEC | 상태 |
| Email Routing | 존 설정은 unconfigured, 규칙 4개(forward 3, drop 1) |
| Web Analytics 사이트 | 2개(bkan.dev 자동, lab.bkan.dev 수동) |
| 알림 정책 | 1개(결제 예산 알림 기본값) |
| 감사 로그(REST v1) | 최근 변경 기록 |
| Radar | bkan.dev 순위 구간(>200,000), 전 세계 AI 봇 비율, 검증된 봇 상위 |
| Intel | bkan.dev 해석 이력 |
| 비어 있음 | Workers 스크립트·라우트, KV, D1, Queues, Turnstile, Tunnel, AI Gateway, Health Checks |
| 안 됨 | Access(꺼짐), Logpush(권한 부족), Page Rules(계정 토큰 미지원) |

## 대시보드 반영
`/cloudflare`에 위 데이터를 전부 넣는다(나중에 뺄 것은 뺀다). lab.bkan.dev는 DNS only라 엣지 요청·보안 이벤트에 잡히지 않고 Web Analytics와 Pages Functions에만 나온다.
