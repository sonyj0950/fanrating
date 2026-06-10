import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 현재 로그인 유저가 이 경기에서 매긴 평점 목록
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

  return NextResponse.json({ items, avg, count: items.length, loggedIn: true, userId, nickname: (session.user as any).name });
}
