import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 경기의 교체 목록 조회
export async function GET(_req: Request, { params }: { params: { matchId: string } }) {
  const subs = await prisma.substitution.findMany({
    where: { matchId: params.matchId },
    orderBy: { minute: "asc" },
  });
  return NextResponse.json(subs);
}

// 교체 목록 전체 교체(replace-all) — 관리자 전용
export async function PUT(req: Request, { params }: { params: { matchId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  if ((session.user as any).role !== "admin")
    return NextResponse.json({ error: "권한없음" }, { status: 403 });

  const body = await req.json();
  const rows = Array.isArray(body.subs) ? body.subs : [];

  // 유효한 행만 추림 (out/in 모두 있고 분이 숫자)
  const clean = rows
    .filter((r: any) => r.outPlayerId && r.inPlayerId && r.outPlayerId !== r.inPlayerId)
    .map((r: any) => ({
      matchId: params.matchId,
      minute: Math.max(0, Math.min(130, Number(r.minute) || 0)),
      outPlayerId: String(r.outPlayerId),
      inPlayerId: String(r.inPlayerId),
    }));

  // 기존 전체 삭제 후 재생성
  await prisma.substitution.deleteMany({ where: { matchId: params.matchId } });
  if (clean.length) await prisma.substitution.createMany({ data: clean });

  const subs = await prisma.substitution.findMany({
    where: { matchId: params.matchId }, orderBy: { minute: "asc" },
  });
  return NextResponse.json(subs);
}
