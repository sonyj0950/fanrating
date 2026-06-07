import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 평점 등록/수정 — 코멘트는 선택 사항
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const b = await req.json();
  const score = Number(b.score);
  if (!b.matchId || !b.playerId)
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  if (!Number.isInteger(score) || score < 2 || score > 9)
    return NextResponse.json({ error: "평점은 2~9 사이여야 합니다." }, { status: 400 });

  const segment = typeof b.segment === "string" && b.segment ? b.segment : "full";
  const comment = (b.comment || "").trim();

  // 코멘트를 작성한 경우에만 검사 (비워도 등록 가능)
  if (comment) {
    if (comment.length < 5)
      return NextResponse.json({ error: "코멘트는 5자 이상 입력하거나 비워주세요." }, { status: 400 });
    if (/^[ㄱ-ㅎㅏ-ㅣ\s]+$/.test(comment))
      return NextResponse.json({ error: "자음/모음만으로는 작성할 수 없습니다." }, { status: 400 });
  }

  const userId = (session.user as any).id;
  await prisma.rating.upsert({
    where: { matchId_playerId_userId_segment: { matchId: b.matchId, playerId: b.playerId, userId, segment } },
    update: { score, comment },
    create: { matchId: b.matchId, playerId: b.playerId, userId, segment, score, comment },
  });
  return NextResponse.json({ ok: true });
}
