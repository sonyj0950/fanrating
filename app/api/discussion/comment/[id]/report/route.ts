import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const AUTO_BLIND = 3;

export async function POST(req: Request, { params }: any) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const userId = (session.user as any).id;

  const c = await prisma.discussionComment.findUnique({ where: { id: params.id } });
  if (!c) return NextResponse.json({ error: "댓글을 찾을 수 없습니다." }, { status: 404 });
  if (c.userId === userId) return NextResponse.json({ error: "본인 댓글은 신고할 수 없습니다." }, { status: 400 });

  const exists = await prisma.discussionReport.findUnique({
    where: { commentId_userId: { commentId: params.id, userId } },
  });
  if (exists) return NextResponse.json({ error: "이미 신고한 댓글입니다." }, { status: 400 });

  const b = await req.json().catch(() => ({}));
  const reason = (b.reason || "").toString().trim().slice(0, 200);
  await prisma.discussionReport.create({ data: { commentId: params.id, userId, reason } });

  const count = await prisma.discussionReport.count({ where: { commentId: params.id } });
  if (count >= AUTO_BLIND && !c.blinded)
    await prisma.discussionComment.update({ where: { id: params.id }, data: { blinded: true } });

  return NextResponse.json({ ok: true });
}
