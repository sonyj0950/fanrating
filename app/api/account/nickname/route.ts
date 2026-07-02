import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: 현재 닉네임 + 설정 완료 여부 / PATCH: 닉네임 설정·변경
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const u = await prisma.user.findUnique({
    where: { id: (session.user as any).id },
    select: { nickname: true, nicknameSet: true },
  });
  return NextResponse.json({ nickname: u?.nickname ?? "", nicknameSet: u?.nicknameSet ?? true });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const nickname = (b.nickname || "").trim();
  if (nickname.length < 2 || nickname.length > 12)
    return NextResponse.json({ error: "닉네임은 2~12자여야 합니다." }, { status: 400 });

  const userId = (session.user as any).id as string;
  const taken = await prisma.user.findUnique({ where: { nickname } });
  if (taken && taken.id !== userId)
    return NextResponse.json({ error: "이미 사용 중인 닉네임입니다." }, { status: 400 });

  await prisma.user.update({ where: { id: userId }, data: { nickname, nicknameSet: true } });
  return NextResponse.json({ ok: true, nickname });
}
