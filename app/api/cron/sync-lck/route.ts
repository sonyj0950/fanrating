import { NextResponse } from "next/server";
import { recentCompletedMatches, isMatchRegistered, importMatch } from "@/lib/lckImport";

// LCK 자동 동기화 (LoL Esports API)
// ?dry=1  : 최근 경기 목록만 받고 등록은 안 함
// ?max=N  : 이번 실행에 등록할 최대 경기 수 (기본 3)
// 보안: CRON_SECRET 설정 시 ?key=<CRON_SECRET> 또는 Authorization: Bearer 필요

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get("authorization") || "";
  if (auth === `Bearer ${secret}`) return true;
  const url = new URL(req.url);
  if (url.searchParams.get("key") === secret) return true;
  return false;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "권한없음" }, { status: 401 });

  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "1";
  const maxPerRun = Number(url.searchParams.get("max") || "3");

  const t0 = Date.now();
  const timing: Record<string, number> = {};
  const log: string[] = [];
  let imported = 0, skipped = 0, failed = 0;

  try {
    const tFetch = Date.now();
    const matches = await recentCompletedMatches(20);
    timing.scheduleFetchMs = Date.now() - tFetch;
    log.push(`최근 끝난 LCK 경기 ${matches.length}개 (스케줄 ${timing.scheduleFetchMs}ms)`);

    if (dry) {
      timing.totalMs = Date.now() - t0;
      return NextResponse.json({
        ok: true, dry: true, count: matches.length, timing,
        matches: matches.map(m => `${m.homeKo} ${m.homeWins}:${m.awayWins} ${m.awayKo} (${m.date.toISOString()})`),
      });
    }

    for (const m of matches) {
      if (imported >= maxPerRun) {
        log.push(`한도(${maxPerRun}경기) 도달 — 나머지는 다음 실행에서`);
        break;
      }
      if (await isMatchRegistered(m)) { skipped++; continue; }
      try {
        const tImp = Date.now();
        const r = await importMatch(m.id, { date: m.date, state: "completed" });
        timing.lastImportMs = Date.now() - tImp;
        if (r.ok) {
          imported++;
          log.push(`등록: ${r.match} (선수 ${r.players}, ${timing.lastImportMs}ms)${r.warning ? " ⚠️ " + r.warning : ""}`);
        } else if (r.reason === "exists") {
          skipped++;
        } else {
          failed++; log.push(`실패(${m.id}): ${r.message}`);
        }
      } catch (e: any) {
        failed++; log.push(`오류(${m.id}): ${e.message}`);
      }
    }

    timing.totalMs = Date.now() - t0;
    return NextResponse.json({ ok: true, checked: matches.length, imported, skipped, failed, timing, log });
  } catch (e: any) {
    timing.totalMs = Date.now() - t0;
    return NextResponse.json({ ok: false, error: e.message, timing, log }, { status: 500 });
  }
}
