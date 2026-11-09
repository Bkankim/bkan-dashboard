// 포털 진입점 목록. 실제 주소는 portal.local.json(gitignore), 없으면 portal.example.json.
// 요청마다 읽으므로 JSON만 고치면 다시 빌드하지 않아도 바뀐다.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { connection } from "next/server";

export type PortalEntry = {
  name: string;
  description: string;
  href: string;
};

export async function loadPortal(): Promise<{ entries: PortalEntry[]; source: "local" | "example" }> {
  await connection();
  const root = process.cwd();
  for (const [file, source] of [["portal.local.json", "local"], ["portal.example.json", "example"]] as const) {
    try {
      const raw = JSON.parse(await readFile(path.join(root, file), "utf8"));
      return { entries: raw.entries as PortalEntry[], source };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  }
  return { entries: [], source: "example" };
}
