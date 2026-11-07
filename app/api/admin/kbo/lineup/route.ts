import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdmin } from "@/lib/adminLog";
import { isKboStartingPitcher } from "@/lib/kboTeams";

// KBO 경기 라인업/교체 편집 (관리자 전용)
// GET  ?matchId=X : 경기 정보 + 홈/원정 1군 로스터 + 현재 라인업/교체
// POST {matchId, homeScore, awayScore, status, home, away, subs} : 라인업·교체 일괄 저장(덮어쓰기)

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
    select: { id: true, sport: true, homeTeam: true, awayTeam: true, date: true, homeScore: true, awayScore: true, status: true },
  });
  if (!match) return NextResponse.json({ error: "경기를 찾을 수 없음" }, { status: 404 });

  // ↩ 최근 라인업 불러오기 — 이 경기보다 앞선 해당 팀의 가장 최근 타순 있는 경기에서 복사
  const recentFor = new URL(req.url).searchParams.get("recentFor");
  if (recentFor) {
    const candidates = await prisma.match.findMany({
      where: {
        sport: "kbo", id: { not: matchId }, date: { lt: match.date },
        OR: [{ homeTeam: recentFor }, { awayTeam: recentFor }],
      },
      orderBy: { date: "desc" }, take: 10,
      select: { id: true, date: true, homeTeam: true, awayTeam: true },
    });
    for (const c of candidates) {
      const rows = await prisma.matchPlayer.findMany({
        where: { matchId: c.id, player: { team: recentFor } },
        select: { playerId: true, role: true, isDefault: true, battingOrder: true, player: { select: { name: true } } },
      });
      if (!rows.some(r => r.battingOrder != null)) continue;
      const batters = Array.from({ length: 9 }, () => ({ playerId: "", position: "" }));
      const pitcherId = rows.find(isKboStartingPitcher)?.playerId ?? "";
      const names: Record<string, string> = {};
      for (const r of rows) {
        names[r.playerId] = r.player.name;
        if (r.battingOrder != null && r.battingOrder >= 1 && r.battingOrder <= 9)
          batters[r.battingOrder - 1] = { playerId: r.playerId, position: r.role || "" };
      }
      const opp = c.homeTeam === recentFor ? c.awayTeam : c.homeTeam;
      const kst = new Date(c.date.getTime() + 9 * 3600 * 1000);
      return NextResponse.json({
        pitcherId, batters, names,
        sourceLabel: `${kst.getUTCMonth() + 1}/${kst.getUTCDate()} vs ${opp}`,
      });
    }
    return NextResponse.json({ error: `${recentFor}의 이전 라인업이 없습니다.` }, { status: 404 });
  }

  const roster = (team: string) =>
    prisma.player.findMany({
      where: { team, rosterActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, position: true, isPitcher: true },
    });
  const [homeRoster, awayRoster] = await Promise.all([roster(match.homeTeam), roster(match.awayTeam)]);

  const lineup = await prisma.matchPlayer.findMany({
    where: { matchId },
    select: { playerId: true, role: true, isDefault: true, battingOrder: true, player: { select: { name: true, team: true, isPitcher: true } } },
  });
  const subs = await prisma.substitution.findMany({
    where: { matchId }, orderBy: { minute: "asc" },
    select: { id: true, minute: true, outPlayerId: true, inPlayerId: true, kind: true },
  });

  return NextResponse.json({ match, homeRoster, awayRoster, lineup, subs });
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "권한없음" }, { status: 403 });
  const b = await req.json();
  if (!b.matchId) return NextResponse.json({ error: "matchId 필요" }, { status: 400 });

  const num = (v: any) => (v === "" || v == null ? null : Number(v));
  const mpRows: any[] = [];
  const seen = new Set<string>();

  const addTeam = (side: any) => {
    if (!side) return;
    if (side.pitcherId && !seen.has(side.pitcherId)) {
      seen.add(side.pitcherId);
      mpRows.push({ matchId: b.matchId, playerId: side.pitcherId, role: "투수", isDefault: true, segment: "all", battingOrder: null });
    }
    (side.batters || []).forEach((bt: any, i: number) => {
      if (!bt?.playerId || seen.has(bt.playerId)) return;
      seen.add(bt.playerId);
      mpRows.push({ matchId: b.matchId, playerId: bt.playerId, role: bt.position || null, isDefault: true, segment: "all", battingOrder: i + 1 });
    });
  };
  addTeam(b.home);
  addTeam(b.away);

  const subRows: any[] = [];
  for (const s of (b.subs || [])) {
    if (!s?.outPlayerId || !s?.inPlayerId) continue;
    if (!seen.has(s.inPlayerId)) {
      seen.add(s.inPlayerId);
      mpRows.push({ matchId: b.matchId, playerId: s.inPlayerId, role: null, isDefault: false, segment: "all", battingOrder: null });
    }
    subRows.push({ matchId: b.matchId, minute: num(s.minute) ?? 0, outPlayerId: s.outPlayerId, inPlayerId: s.inPlayerId, kind: s.kind || null });
  }

  const ops: any[] = [
    prisma.match.update({ where: { id: b.matchId }, data: { homeScore: num(b.homeScore), awayScore: num(b.awayScore), status: b.status || "finished" } }),
    prisma.matchPlayer.deleteMany({ where: { matchId: b.matchId } }),
    prisma.substitution.deleteMany({ where: { matchId: b.matchId } }),
  ];
  if (mpRows.length) ops.push(prisma.matchPlayer.createMany({ data: mpRows }));
  if (subRows.length) ops.push(prisma.substitution.createMany({ data: subRows }));
  await prisma.$transaction(ops);

  await logAdmin("EDIT_KBO_LINEUP", "Match", b.matchId, `선수 ${mpRows.length} · 교체 ${subRows.length}`);
  return NextResponse.json({ ok: true, players: mpRows.length, subs: subRows.length });
}
