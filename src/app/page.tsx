// bkan dashboard 메인 - 운영 포털. 제목과 진입점만 둔다.
// 제목은 정적 셸로 미리 그리고, 진입점 목록(portal.local.json)은 요청 때 읽어 Suspense 뒤에서 채운다.

import Link from "next/link";
import { Suspense } from "react";
import { loadPortal } from "@/lib/portal";

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-16 flex flex-col gap-10">
      <header className="border-b border-ink pb-4">
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">bkan dashboard</h1>
      </header>
      <Suspense fallback={<p className="text-xs">불러오는 중</p>}>
        <PortalList />
      </Suspense>
    </div>
  );
}

const CARD =
  "border border-ink p-5 flex flex-col gap-2 h-full hover:bg-ink hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink [&:hover_code]:text-paper";

async function PortalList() {
  const { entries, source } = await loadPortal();
  return (
    <>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {entries.map((e) => {
          const internal = e.href.startsWith("/");
          const body = (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-lg font-semibold">{e.name}</span>
                <Arrow external={!internal} />
              </div>
              <p className="text-sm">{e.description}</p>
              <code className="font-mono text-[11px] text-ink-soft break-all">{e.href}</code>
            </>
          );
          return (
            <li key={e.name}>
              {internal ? (
                <Link href={e.href} className={CARD}>{body}</Link>
              ) : (
                <a href={e.href} target="_blank" rel="noreferrer" className={CARD}>{body}</a>
              )}
            </li>
          );
        })}
      </ul>
      {source === "example" ? (
        <p className="text-xs">portal.local.json이 없어 예시 주소를 보여 주고 있다.</p>
      ) : null}
    </>
  );
}

// 선으로 그린 화살표(안 페이지 →, 바깥 도구 ↗). 글꼴마다 크기가 달라 SVG로 맞춘다.
function Arrow({ external }: { external: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="shrink-0">
      <g fill="none" stroke="currentColor" strokeWidth="1.5" transform={external ? "rotate(-45 8 8)" : undefined}>
        <line x1="2" y1="8" x2="14" y2="8" />
        <polyline points="9,3 14,8 9,13" />
      </g>
    </svg>
  );
}
