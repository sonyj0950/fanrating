import { NextResponse } from "next/server";
import { importFixture, recentFinishedFixtures, isMatchRegistered } from "@/lib/eplImport";

// EPL 자동 동기화 (Cron 또는 외부 스케줄러가 호출)
// - 최근 끝난 EPL 경기 중 아직 등록 안 된 것만 자동 등록
// - 무료(Hobby) 함수 시간 한도(~30초)를 넘기지 않도록 한 번에 최대 3경기만 등록
//   (나머지는 다음 실행 때 자동으로 채워짐 — Cron이 매일 돌므로 점점 backfill)
// - 시즌 번호는 환경변수 EPL_SEASON (없으면 2024). 유료 전환 후 현재 시즌으로 바꾸려면 2026 등으로.
//
// 보안: CRON_SECRET이 설정돼 있으면 Authorization: Bearer <CRON_SECRET> 또는 ?key=<CRON_SECRET> 필요

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_PER_RUN = 3; // 한 번 실행에 새로 등록할 최대 경기 수

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

  const season = Number(process.env.EPL_SEASON || "2024");
  const log: string[] = [];
  let imported = 0, skipped = 0, failed = 0;

  try {
    const fixtures = await recentFinishedFixtures(season, 20);
    log.push(`시즌 ${season}: 최근 끝난 경기 ${fixtures.length}개 확인`);

    for (const fx of fixtures) {
      if (imported >= MAX_PER_RUN) {
        log.push(`이번 실행 한도(${MAX_PER_RUN}경기) 도달 — 나머지는 다음 실행에서`);
        break;
      }
      // 이미 등록된 경기는 API 호출 없이 건너뜀 (빠름)
      if (await isMatchRegistered(fx)) { skipped++; continue; }

      try {
        const r = await importFixture(fx.id);
        if (r.ok) {
          imported++;
          log.push(`등록: ${r.match} (선수 ${r.players}, 교체 ${r.subs})`);
          continue;
        }
        if (r.reason === "exists") { skipped++; }
        else { failed++; log.push(`실패(${fx.id}): ${r.message}`); }
      } catch (e: any) {
        failed++;
        log.push(`오류(${fx.id}): ${e.message}`);
      }
    }

    return NextResponse.json({
      ok: true, season,
      checked: fixtures.length, imported, skipped, failed,
      log,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message, log }, { status: 500 });
  }
}
