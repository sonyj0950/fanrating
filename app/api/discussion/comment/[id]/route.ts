import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 본인 또는 관리자: 토론 댓글 삭제
export async function DELETE(_req: Request, { params }: any) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const c = await prisma.discussionComment.findUnique({ where: { id: params.id } });
  if (!c) return NextResponse.json({ error: "댓글을 찾을 수 없습니다." }, { status: 404 });

  const isAdmin = (session.user as any).role === "admin";
  const isOwner = c.userId === (session.user as any).id;
  if (!isAdmin && !isOwner) return NextResponse.json({ error: "권한없음" }, { status: 403 });

  await prisma.discussionComment.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}

// 관리자: 블라인드 토글
export async function PATCH(req: Request, { params }: any) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin")
    return NextResponse.json({ error: "권한없음" }, { status: 403 });
  const b = await req.json();
  await prisma.discussionComment.update({ where: { id: params.id }, data: { blinded: !!b.blinded } });
  return NextResponse.json({ ok: true });
}
