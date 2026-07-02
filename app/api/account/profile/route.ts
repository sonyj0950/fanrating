import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 내 프로필 설정. GET: 현재 값 / PATCH: 공개 여부 변경
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const u = await prisma.user.findUnique({
    where: { id: (session.user as any).id },
    select: { profilePublic: true },
  });
  return NextResponse.json({ profilePublic: u?.profilePublic ?? true });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (typeof b.profilePublic !== "boolean")
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });

  await prisma.user.update({
    where: { id: (session.user as any).id },
    data: { profilePublic: b.profilePublic },
  });
  return NextResponse.json({ ok: true, profilePublic: b.profilePublic });
}
