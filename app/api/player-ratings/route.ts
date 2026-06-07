import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 선수별 평점 상세 — 평균/참여수 + 코멘트(대댓글·좋아요 포함)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const matchId = searchParams.get("matchId");
  const playerId = searchParams.get("playerId");
  if (!matchId || !playerId)
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });

  const ratings = await prisma.rating.findMany({
    where: { matchId, playerId },
    include: {
      user: { select: { nickname: true } },
      replies: { include: { user: { select: { nickname: true } } }, orderBy: { createdAt: "asc" } },
      _count: { select: { likes: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const count = ratings.length;
  const avg = count
    ? Number((ratings.reduce((a, r) => a + r.score, 0) / count).toFixed(2))
    : 0;

  // 평균은 전체 평점 기준, 목록에는 코멘트가 있는 것만 (좋아요순)
  const comments = ratings
    .filter(r => r.comment.trim() !== "")
    .map(r => ({
      id: r.id,
      username: r.user.nickname,
      score: r.score,
      text: r.comment,
      likes: r._count.likes,
      replies: r.replies.map(rp => ({ id: rp.id, username: rp.user.nickname, text: rp.text })),
    }))
    .sort((a, b) => b.likes - a.likes);

  return NextResponse.json({ avg, count, comments });
}
