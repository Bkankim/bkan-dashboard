# bkan-dashboard 에이전트 지침

이 파일이 리포 지침의 실물이다. `CLAUDE.md`는 이 파일을 임포트하는 한 줄이다.
구조·절차·결정은 여기에 옮겨 적지 않고 `README.md`에 둔다.

## 목표
내가 운영하고 쓰는 도구들의 진입점(포털, 목록의 정본)이다. `/cloudflare`는 Cloudflare API로 받을 수 있는 것을 한곳에 모은 페이지다.

## 확인 명령
- `pnpm lint`
- `pnpm build`

## README 길잡이
`README.md`는 자동으로 실리지 않는다. 아래 일을 하기 전에 해당 절을 직접 읽는다.
- 포털 카드를 더하거나 페이지를 바꿀 때: "페이지"
- 상시 서버에 반영하거나 launchd·테일넷 노출을 건드릴 때: "상시 실행 (맥 + 다른 PC에서 보기)"
- 질의·캐시·토큰을 건드릴 때: "데이터", "결정과 절충"
- 폴더를 옮기거나 새 섹션을 만들 때: "구조"
- 화면을 그릴 때: "화면 규칙 (와이어프레임)"
- 작업을 마치고 상태가 바뀌었을 때: "상태", "한계와 다음"을 고친다

## 규칙
- 이 Next.js(16)는 기억 속 버전과 API·규약이 다를 수 있다. `src/`를 고치기 전에 `node_modules/next/dist/docs/`에서 해당 가이드를 읽고, 폐기 안내를 따른다.
- `next.config.ts`에 `agentRules: false`가 없어서 `next dev`가 이 파일 끝에 영어 안내 블록(`<!-- BEGIN:nextjs-agent-rules -->`)을 다시 붙인다. 같은 안내가 바로 위 줄에 있으니 그 블록은 커밋하지 않는다.
- Cloudflare 호출은 `src/lib/cf/client.ts`의 `gql`·`rest`를 거친다. 전역 `fetch`로 바꾸지 않는다(느려진 이유는 README "결정과 절충").
- `cacheComponents`가 켜져 있다. 파일·환경 변수·요청 값을 읽는 컴포넌트는 `Suspense` 안에 두고, 캐시하지 않을 읽기는 `connection()`을 먼저 부른다. 어기면 `pnpm build`가 실패한다.
- 토큰은 서버에서만 쓴다. `src/lib/cf/`를 클라이언트 컴포넌트에서 가져오지 않는다(`server-only`가 막는다).
- 시간 단위: RUM 성능·Web Vitals 분위수, Functions `cpuTime`은 마이크로초라 `fmt.us`로 그린다. Functions 응답 시간은 `duration`(GB-s)이 아니라 `wallTime / requests`로 낸다.
- 공개 리포다. 실제 테일넷 주소·포트는 `portal.local.json`에만 두고, 계정·존 ID와 토큰 값은 코드·문서·`docs/research/`에 커밋하지 않는다.
