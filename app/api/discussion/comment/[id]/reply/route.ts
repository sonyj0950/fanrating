import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: any) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const text = (b.text || "").toString().trim();
  if (!text) return NextResponse.json({ error: "내용을 입력해주세요." }, { status: 400 });
  if (text.length > 300) return NextResponse.json({ error: "300자 이내로 작성해주세요." }, { status: 400 });

  const c = await prisma.discussionComment.findUnique({ where: { id: params.id } });
  if (!c) return NextResponse.json({ error: "댓글을 찾을 수 없습니다." }, { status: 404 });

  await prisma.discussionReply.create({
    data: { commentId: params.id, userId: (session.user as any).id, text },
  });
  return NextResponse.json({ ok: true });
}
