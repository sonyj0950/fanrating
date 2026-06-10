import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const b = await req.json();
  const password = b.password || "";

  const userId = (session.user as any).id;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });

  // 마지막 관리자는 탈퇴 불가 (사이트 운영 불능 방지)
  if (user.role === "admin") {
    const adminCount = await prisma.user.count({ where: { role: "admin" } });
    if (adminCount <= 1)
      return NextResponse.json({ error: "마지막 관리자 계정은 탈퇴할 수 없습니다." }, { status: 400 });
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 400 });

  // 작성물 연쇄 삭제 후 계정 삭제
  await prisma.$transaction([
    prisma.reply.deleteMany({ where: { userId } }),
    prisma.report.deleteMany({ where: { userId } }),
    prisma.commentLike.deleteMany({ where: { userId } }),
    prisma.rating.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);
  return NextResponse.json({ ok: true });
}
