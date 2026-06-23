import { NextResponse } from "next/server";
import { importFixture, recentFinishedFixtures, isMatchRegistered } from "@/lib/eplImport";

// EPL 자동 동기화 + 진단
// ?dry=1  : 시즌 목록만 받고 등록은 안 함 (시즌 호출 속도 측정용)
// ?max=N  : 이번 실행에 등록할 최대 경기 수 (기본 1)
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
  if (!authorized(req)) {
    return NextResponse.json({ error: "권한없음" }, { status: 401 });
  }

  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "1";
  const maxPerRun = Number(url.searchParams.get("max") || "1");
  const season = Number(process.env.EPL_SEASON || "2024");

  const t0 = Date.now();
  const timing: Record<string, number> = {};
  const log: string[] = [];
  let imported = 0, skipped = 0, failed = 0;

  try {
    const tFetch = Date.now();
    const fixtures = await recentFinishedFixtures(season, 20);
    timing.seasonFetchMs = Date.now() - tFetch;
    log.push(`시즌 ${season}: 최근 끝난 경기 ${fixtures.length}개 (시즌호출 ${timing.seasonFetchMs}ms)`);

    if (dry) {
      timing.totalMs = Date.now() - t0;
      return NextResponse.json({ ok: true, dry: true, season, fixtures: fixtures.length, timing, log });
    }

    for (const fx of fixtures) {
      if (imported >= maxPerRun) {
        log.push(`한도(${maxPerRun}경기) 도달 — 나머지는 다음 실행에서`);
        break;
      }
      const tChk = Date.now();
      const already = await isMatchRegistered(fx);
      timing.lastCheckMs = Date.now() - tChk;
      if (already) { skipped++; continue; }

      try {
        const tImp = Date.now();
        const r = await importFixture(fx.id);
        timing.lastImportMs = Date.now() - tImp;
        if (r.ok) {
          imported++;
          log.push(`등록: ${r.match} (선수 ${r.players}, 교체 ${r.subs}, ${timing.lastImportMs}ms)`);
          continue;
        }
        if (r.reason === "exists") { skipped++; }
        else { failed++; log.push(`실패(${fx.id}): ${r.message}`); }
      } catch (e: any) {
        failed++;
        log.push(`오류(${fx.id}): ${e.message}`);
      }
    }

    timing.totalMs = Date.now() - t0;
    return NextResponse.json({ ok: true, season, checked: fixtures.length, imported, skipped, failed, timing, log });
  } catch (e: any) {
    timing.totalMs = Date.now() - t0;
    return NextResponse.json({ ok: false, error: e.message, timing, log }, { status: 500 });
  }
}
