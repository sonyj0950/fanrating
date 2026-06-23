import { NextResponse } from "next/server";
import { importFixture, recentFinishedFixtureIds } from "@/lib/eplImport";

// EPL 자동 동기화 (Cron 또는 외부 스케줄러가 호출)
// - 최근 끝난 EPL 경기들을 찾아 아직 등록 안 된 것만 자동 등록
// - 시즌 번호는 환경변수 EPL_SEASON으로 제어 (없으면 2024 = 무료로 받을 수 있는 시즌)
//   유료 전환 후 현재 시즌으로 운영하려면 Vercel에서 EPL_SEASON=2026 등으로 바꾸면 됨
//
// 보안: CRON_SECRET 환경변수가 설정돼 있으면, 요청에
//   Authorization: Bearer <CRON_SECRET>  헤더 또는  ?key=<CRON_SECRET>  가 있어야 실행
//   (Vercel Cron은 자동으로 Authorization 헤더를 붙여줌)

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // 시크릿 미설정이면 통과 (개발/초기). 운영 시 설정 권장.
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
    const ids = await recentFinishedFixtureIds(season, 10);
    log.push(`시즌 ${season}: 최근 끝난 경기 ${ids.length}개 확인`);

    for (const id of ids) {
      try {
        const r = await importFixture(id);
        if (r.ok) {
          imported++;
          log.push(`등록: ${r.match} (선수 ${r.players}, 교체 ${r.subs})`);
          continue;
        }
        if (r.reason === "exists") {
          skipped++;
        } else {
          failed++;
          log.push(`실패(${id}): ${r.message}`);
        }
      } catch (e: any) {
        failed++;
        log.push(`오류(${id}): ${e.message}`);
      }
    }

    return NextResponse.json({
      ok: true, season,
      checked: ids.length, imported, skipped, failed,
      log,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message, log }, { status: 500 });
  }
}
