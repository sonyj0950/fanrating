import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// LCK 경기 라인업/세트 수동 편집 (관리자 전용, 외부 API 호출 없음)
// GET  ?matchId=X : 경기 + 양 팀 기존 LCK 선수(자동완성) + 현재 라인업/세트결과
// POST {matchId, status, home, away, sets} : 라인업·챔피언·세트 승팀 일괄 저장(덮어쓰기)

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  return !!session && (session.user as any).role === "admin";
}

export async function GET(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "권한없음" }, { status: 403 });
  const matchId = new URL(req.url).searchParams.get("matchId");
  if (!matchId) return NextResponse.json({ error: "matchId 필요" }, { status: 400 });

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { id: true, sport: true, homeTeam: true, awayTeam: true, date: true, homeScore: true, awayScore: true, status: true, setResults: true },
  });
  if (!match) return NextResponse.json({ error: "경기를 찾을 수 없음" }, { status: 404 });

  const roster = (team: string) =>
    prisma.player.findMany({ where: { team }, orderBy: { name: "asc" }, select: { id: true, name: true, position: true } });
  const [homeRoster, awayRoster] = await Promise.all([roster(match.homeTeam), roster(match.awayTeam)]);

  const lineup = await prisma.matchPlayer.findMany({
    where: { matchId },
    select: { role: true, champions: true, player: { select: { name: true, team: true } } },
  });

  return NextResponse.json({ match, homeRoster, awayRoster, lineup });
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "권한없음" }, { status: 403 });
  const b = await req.json();
  if (!b.matchId) return NextResponse.json({ error: "matchId 필요" }, { status: 400 });

  const sets: any[] = b.sets || [];
  // 세트 승팀 → setResults + 스코어
  const setResults: Record<string, string> = {};
  let homeWins = 0, awayWins = 0;
  sets.forEach((s, i) => {
    if (s?.winner === "home" || s?.winner === "away") {
      setResults[`set${i + 1}`] = s.winner;
      if (s.winner === "home") homeWins++; else awayWins++;
    }
  });

  // 선수 upsert(이름,팀) + 세트별 챔피언 집계 → MatchPlayer rows
  const mpRows: any[] = [];
  const handleTeam = async (team: string, side: "home" | "away", players: any[]) => {
    for (const p of (players || [])) {
      const name = (p?.name || "").trim();
      const lane = p?.lane;
      if (!name || !lane) continue;
      let player = await prisma.player.findFirst({ where: { name, team } });
      if (!player) player = await prisma.player.create({ data: { name, team, position: lane, rosterActive: true } });
      else await prisma.player.update({ where: { id: player.id }, data: { position: lane, rosterActive: true } });

      const champs: Record<string, string> = {};
      sets.forEach((s, i) => {
        const c = (side === "home" ? s.homeChamps : s.awayChamps)?.[lane];
        if (c && String(c).trim()) champs[`set${i + 1}`] = String(c).trim();
      });
      mpRows.push({
        matchId: b.matchId, playerId: player.id, role: lane, isDefault: true, segment: "all",
        champions: Object.keys(champs).length ? champs : null,
      });
    }
  };
  await handleTeam(b.home?.team, "home", b.home?.players);
  await handleTeam(b.away?.team, "away", b.away?.players);

  const ops: any[] = [
    prisma.match.update({ where: { id: b.matchId }, data: { homeScore: homeWins, awayScore: awayWins, status: b.status || "finished", setResults } }),
    prisma.matchPlayer.deleteMany({ where: { matchId: b.matchId } }),
  ];
  if (mpRows.length) ops.push(prisma.matchPlayer.createMany({ data: mpRows }));
  await prisma.$transaction(ops);

  return NextResponse.json({ ok: true, players: mpRows.length, sets: Object.keys(setResults).length, score: `${homeWins}:${awayWins}` });
}
