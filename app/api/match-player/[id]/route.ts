import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") return null;
  return session;
}

// 출전 구간 변경 / 커스텀 위치 저장
export async function PATCH(req: Request, { params }: any) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: "권한없음" }, { status: 403 });

  const b = await req.json();
  const data: any = {};

  if (typeof b.segment === "string" && ["all", "first", "second"].includes(b.segment))
    data.segment = b.segment;

  // 역할(포지션 코드) 변경 — 드래그로 위치 옮기면 자동 갱신
  if (typeof b.role === "string") data.role = b.role.trim();

  // 커스텀 위치 저장 (posX/posY는 0~100 %)
  if (b.resetPos === true) {
    data.posX = null;
    data.posY = null;
  } else {
    if (typeof b.posX === "number") data.posX = Math.max(0, Math.min(100, b.posX));
    if (typeof b.posY === "number") data.posY = Math.max(0, Math.min(100, b.posY));
  }

  if (Object.keys(data).length === 0)
    return NextResponse.json({ error: "변경할 내용이 없습니다." }, { status: 400 });

  await prisma.matchPlayer.update({ where: { id: params.id }, data });
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
