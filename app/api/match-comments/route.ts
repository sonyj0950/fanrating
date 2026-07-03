import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 경기 전체 선수별 코멘트 요약 — 평점 순위 리스트의 "베스트 한 줄 + 인라인 토론"용.
// GET ?matchId=X →
//   players:   { [playerId]: { count, top: [{id, score, text, likes}] } }  (블라인드 제외, 좋아요순 상위 2)
//   myRatings: { [playerId]: { [segment]: score } }                        (로그인 유저의 내 평점 — CTA 라벨용)
export async function GET(req: Request) {
  const matchId = new URL(req.url).searchParams.get("matchId");
  if (!matchId) return NextResponse.json({ error: "matchId 필요" }, { status: 400 });

  const session = await getServerSession(authOptions);
  const viewerId = (session?.user as any)?.id ?? null;

  const ratings = await prisma.rating.findMany({
    where: { matchId },
    select: {
      id: true, playerId: true, userId: true, segment: true, score: true,
      comment: true, blinded: true,
      _count: { select: { likes: true } },
    },
  });

  const players: Record<string, { count: number; top: { id: string; score: number; text: string; likes: number }[] }> = {};
  const myRatings: Record<string, Record<string, number>> = {};

  for (const r of ratings) {
    if (viewerId && r.userId === viewerId) (myRatings[r.playerId] ||= {})[r.segment] = r.score;
    if (r.blinded || r.comment.trim() === "") continue;
    const p = (players[r.playerId] ||= { count: 0, top: [] });
    p.count++;
    p.top.push({ id: r.id, score: r.score, text: r.comment, likes: r._count.likes });
  }
  for (const pid of Object.keys(players)) {
    players[pid].top.sort((a, b) => b.likes - a.likes);
    players[pid].top = players[pid].top.slice(0, 2);
  }

  return NextResponse.json({ players, myRatings });
}
