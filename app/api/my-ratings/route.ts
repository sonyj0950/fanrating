import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 현재 로그인 유저가 이 경기에서 매긴 평점 목록 + 내 최고 평점 선수
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const matchId = searchParams.get("matchId");
  if (!matchId) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });

  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ items: [], loggedIn: false });

  const userId = (session.user as any).id;
  const ratings = await prisma.rating.findMany({
    where: { matchId, userId },
    include: { player: { select: { name: true, team: true } } },
    orderBy: { score: "desc" },
  });

  const items = ratings.map(r => ({
    playerId: r.playerId,
    name: r.player.name,
    team: r.player.team,
    segment: r.segment,
    score: r.score,
    comment: r.comment,
  }));

  const avg = items.length
    ? Number((items.reduce((a, r) => a + r.score, 0) / items.length).toFixed(2))
    : 0;

  // 내가 가장 높은 점수를 준 선수 (선수별 내 최고 점수 기준)
  const myBestByPlayer: Record<string, { name: string; team: string; score: number }> = {};
  for (const r of items) {
    if (!myBestByPlayer[r.playerId] || r.score > myBestByPlayer[r.playerId].score)
      myBestByPlayer[r.playerId] = { name: r.name, team: r.team, score: r.score };
  }
  const playerIds = Object.keys(myBestByPlayer);
  let top: { playerId: string; name: string; team: string; score: number } | null = null;

  if (playerIds.length > 0) {
    const maxScore = Math.max(...playerIds.map(id => myBestByPlayer[id].score));
    const tied = playerIds.filter(id => myBestByPlayer[id].score === maxScore);

    if (tied.length === 1) {
      const id = tied[0];
      top = { playerId: id, ...myBestByPlayer[id] };
    } else {
      // 동점 → 총평 총점(전체 유저 점수 합)이 가장 높은 선수
      const all = await prisma.rating.findMany({
        where: { matchId, playerId: { in: tied } },
        select: { playerId: true, score: true },
      });
      const sum: Record<string, number> = {};
      for (const r of all) sum[r.playerId] = (sum[r.playerId] || 0) + r.score;
      let bestId = tied[0];
      for (const id of tied) if ((sum[id] || 0) > (sum[bestId] || 0)) bestId = id;
      top = { playerId: bestId, ...myBestByPlayer[bestId] };
    }
  }

  return NextResponse.json({
    items, avg, count: items.length, top,
    loggedIn: true, userId, nickname: (session.user as any).name,
  });
}
