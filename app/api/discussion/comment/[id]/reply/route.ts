import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { verificationBlock } from "@/lib/verified";

export async function POST(req: Request, { params }: any) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const userId = (session.user as any).id;
  if (!(await rateLimit("write", `u:${userId}`)))
    return NextResponse.json({ error: "요청이 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  const blocked = await verificationBlock(userId);
  if (blocked) return NextResponse.json({ error: blocked }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const text = (b.text || "").toString().trim();
  if (!text) return NextResponse.json({ error: "내용을 입력해주세요." }, { status: 400 });
  if (text.length > 300) return NextResponse.json({ error: "300자 이내로 작성해주세요." }, { status: 400 });

  const c = await prisma.discussionComment.findUnique({ where: { id: params.id } });
  if (!c) return NextResponse.json({ error: "댓글을 찾을 수 없습니다." }, { status: 404 });

  await prisma.discussionReply.create({
    data: { commentId: params.id, userId, text },
  });
  return NextResponse.json({ ok: true });
}
