import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin")
    return NextResponse.json({ error: "권한없음" }, { status: 403 });

  // 신고가 1건 이상인 코멘트 모으기
  const ratings = await prisma.rating.findMany({
    where: { reports: { some: {} } },
    include: {
      user: { select: { nickname: true } },
      player: { select: { name: true } },
      match: { select: { id: true, sport: true, homeTeam: true, awayTeam: true } },
      reports: { include: { user: { select: { nickname: true } } }, orderBy: { createdAt: "desc" } },
    },
  });

  const items = ratings
    .map(r => ({
      id: r.id,
      text: r.comment,
      author: r.user.nickname,
      player: r.player.name,
      blinded: r.blinded,
      matchId: r.match.id,
      sport: r.match.sport,
      matchLabel: `${r.match.homeTeam} vs ${r.match.awayTeam}`,
      reportCount: r.reports.length,
      reasons: r.reports.map(rp => ({ by: rp.user.nickname, reason: rp.reason, at: rp.createdAt })),
    }))
    .sort((a, b) => b.reportCount - a.reportCount);

  return NextResponse.json({ items });
}
