import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: any) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const userId = (session.user as any).id;

  const existing = await prisma.discussionLike.findUnique({
    where: { commentId_userId: { commentId: params.id, userId } },
  });
  if (existing) {
    await prisma.discussionLike.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true, liked: false });
  }
  await prisma.discussionLike.create({ data: { commentId: params.id, userId } });
  return NextResponse.json({ ok: true, liked: true });
}
