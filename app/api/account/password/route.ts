import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const b = await req.json();
  const current = b.current || "";
  const next = b.next || "";
  if (next.length < 4)
    return NextResponse.json({ error: "새 비밀번호는 4자 이상이어야 합니다." }, { status: 400 });

  const userId = (session.user as any).id;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });

  const ok = await bcrypt.compare(current, user.password);
  if (!ok) return NextResponse.json({ error: "현재 비밀번호가 올바르지 않습니다." }, { status: 400 });

  await prisma.user.update({
    where: { id: userId },
    data: { password: await bcrypt.hash(next, 10) },
  });
  return NextResponse.json({ ok: true });
}
