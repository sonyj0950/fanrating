import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 코멘트 좋아요 토글
export async function POST(_req: Request, { params }: any) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const userId = (session.user as any).id;
  const rating = await prisma.rating.findUnique({ where: { id: params.id } });
  if (!rating) return NextResponse.json({ error: "코멘트를 찾을 수 없습니다." }, { status: 404 });

  const existing = await prisma.commentLike.findUnique({
    where: { ratingId_userId: { ratingId: params.id, userId } },
  });
  if (existing) {
    await prisma.commentLike.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true, liked: false });
  }
  await prisma.commentLike.create({ data: { ratingId: params.id, userId } });
  return NextResponse.json({ ok: true, liked: true });
}
