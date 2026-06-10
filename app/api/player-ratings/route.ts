import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 선수별 평점 상세 — 평균/참여수 + 코멘트(대댓글·좋아요·신고/블라인드 포함)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const matchId = searchParams.get("matchId");
  const playerId = searchParams.get("playerId");
  if (!matchId || !playerId)
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });

  const session = await getServerSession(authOptions);
  const viewerId = (session?.user as any)?.id ?? null;
  const isAdmin = (session?.user as any)?.role === "admin";

  const ratings = await prisma.rating.findMany({
    where: { matchId, playerId },
    include: {
      user: { select: { nickname: true } },
      replies: { include: { user: { select: { nickname: true } } }, orderBy: { createdAt: "asc" } },
      reports: { select: { userId: true } },
      _count: { select: { likes: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const count = ratings.length;
  const avg = count
    ? Number((ratings.reduce((a, r) => a + r.score, 0) / count).toFixed(2))
    : 0;

  // 점수 분포 (1~10) — 막대그래프용
  const dist: Record<number, number> = {2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0};
  for (const r of ratings) if (dist[r.score] !== undefined) dist[r.score]++;

  const comments = ratings
    .filter(r => r.comment.trim() !== "")
    .map(r => ({
      id: r.id,
      username: r.user.nickname,
      score: r.score,
      text: r.comment,
      likes: r._count.likes,
      blinded: r.blinded,
      reportCount: r.reports.length,
      reportedByMe: viewerId ? r.reports.some(rp => rp.userId === viewerId) : false,
      mine: viewerId ? r.userId === viewerId : false,
      replies: r.replies.map(rp => ({ id: rp.id, username: rp.user.nickname, text: rp.text })),
    }))
    .sort((a, b) => b.likes - a.likes);

  return NextResponse.json({ avg, count, comments, isAdmin });
}
