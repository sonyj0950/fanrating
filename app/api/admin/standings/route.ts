import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseStandings, replaceStandings, syncEplStandings } from "@/lib/standings";
import { currentEplSeason } from "@/lib/eplImport";

// 순위 관리 (관리자 전용)
// GET    ?league=kbo      : 해당 리그 순위 행
// POST   {league,text}    : KBO/LCK 수동 붙여넣기 저장 (league=epl 이면 API 자동 갱신)

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  return !!session && (session.user as any).role === "admin";
}

export async function GET(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "권한없음" }, { status: 403 });
  const league = new URL(req.url).searchParams.get("league");
  if (!league) return NextResponse.json({ error: "league 필요" }, { status: 400 });
  const rows = await prisma.standing.findMany({ where: { league }, orderBy: { rank: "asc" } });
  return NextResponse.json({ league, rows });
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "권한없음" }, { status: 403 });
  const { league, text } = await req.json();
  if (!league) return NextResponse.json({ error: "league 필요" }, { status: 400 });

  // EPL은 API 자동 — 수동 저장 대신 즉시 동기화
  if (league === "epl" || league === "kleague") {
    if (league === "epl") {
      const season = currentEplSeason();
      const n = await syncEplStandings(season);
      return NextResponse.json({ ok: true, auto: true, season, count: n });
    }
  }

  // KBO·LCK·(kleague 수동) : 붙여넣기 파싱. 축구계열은 승-무-패 순, 야구/LoL은 승-패-무 순.
  const drawBeforeLoss = league === "kleague";
  const rows = parseStandings(text || "", drawBeforeLoss);
  if (rows.length === 0) return NextResponse.json({ error: "유효한 순위 줄이 없습니다." }, { status: 400 });
  const n = await replaceStandings(league, rows);
  return NextResponse.json({ ok: true, count: n });
}
