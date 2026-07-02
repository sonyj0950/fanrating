import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdmin } from "@/lib/adminLog";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") return null;
  return session;
}

// 관리자: 코멘트 블라인드 / 복구 (PATCH), 영구 삭제 (DELETE)
export async function PATCH(req: Request, { params }: any) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: "권한없음" }, { status: 403 });
  const b = await req.json();
  const blinded = !!b.blinded;
  await prisma.rating.update({ where: { id: params.id }, data: { blinded } });
  await logAdmin(blinded ? "BLIND_COMMENT" : "UNBLIND_COMMENT", "Rating", params.id);
  return NextResponse.json({ ok: true, blinded });
}

export async function DELETE(_req: Request, { params }: any) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: "권한없음" }, { status: 403 });
  // 평점 자체를 지우면 점수까지 사라지므로, 코멘트 텍스트만 비우고 블라인드 해제
  const before = await prisma.rating.findUnique({ where: { id: params.id }, select: { comment: true } });
  await prisma.rating.update({
    where: { id: params.id },
    data: { comment: "", blinded: false },
  });
  await prisma.report.deleteMany({ where: { ratingId: params.id } });
  await logAdmin("DELETE_COMMENT", "Rating", params.id, before?.comment ? `"${before.comment.slice(0, 60)}"` : "");
  return NextResponse.json({ ok: true });
}
