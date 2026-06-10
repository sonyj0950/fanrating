import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") return null;
  return session;
}

// 골·어시스트 기록 / 경기 상태 수정
export async function PATCH(req: Request, { params }: any) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: "권한없음" }, { status: 403 });

  const b = await req.json();
  const data: any = {};
  if (typeof b.record === "string") data.record = b.record.trim() || null;
  if (typeof b.status === "string" && ["scheduled", "live", "finished"].includes(b.status))
    data.status = b.status;

  if (Object.keys(data).length === 0)
    return NextResponse.json({ error: "변경할 내용이 없습니다." }, { status: 400 });

  await prisma.match.update({ where: { id: params.id }, data });
  return NextResponse.json({ ok: true });
}

// 경기 삭제 (선수 명단·평점·대댓글 포함)
export async function DELETE(_req: Request, { params }: any) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: "권한없음" }, { status: 403 });

  const exists = await prisma.match.findUnique({ where: { id: params.id } });
  if (!exists) return NextResponse.json({ error: "경기를 찾을 수 없습니다." }, { status: 404 });

  await prisma.$transaction([
    // ※ 대댓글(Reply) 모델을 추가한 경우. 추가 전이라면 이 줄은 제거하세요.
    prisma.reply.deleteMany({ where: { rating: { matchId: params.id } } }),
    prisma.rating.deleteMany({ where: { matchId: params.id } }),
    prisma.matchPlayer.deleteMany({ where: { matchId: params.id } }),
    prisma.match.delete({ where: { id: params.id } }),
  ]);
  return NextResponse.json({ ok: true });
}
