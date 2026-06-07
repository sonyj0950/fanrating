import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") return null;
  return session;
}

// 출전 구간 변경 (all | first | second)
export async function PATCH(req: Request, { params }: any) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: "권한없음" }, { status: 403 });

  const b = await req.json();
  const segment = ["all", "first", "second"].includes(b.segment) ? b.segment : "all";

  await prisma.matchPlayer.update({ where: { id: params.id }, data: { segment } });
  return NextResponse.json({ ok: true });
}

// 명단에서 제거 (해당 경기의 이 선수 평점도 함께 삭제)
export async function DELETE(_req: Request, { params }: any) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: "권한없음" }, { status: 403 });

  const mp = await prisma.matchPlayer.findUnique({ where: { id: params.id } });
  if (!mp) return NextResponse.json({ error: "선수를 찾을 수 없습니다." }, { status: 404 });

  await prisma.$transaction([
    prisma.rating.deleteMany({ where: { matchId: mp.matchId, playerId: mp.playerId } }),
    prisma.matchPlayer.delete({ where: { id: params.id } }),
  ]);
  return NextResponse.json({ ok: true });
}
