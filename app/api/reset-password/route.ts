import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/tokens";
import { rateLimit, clientIp } from "@/lib/rateLimit";

// 비밀번호 재설정 확정: 토큰 + 새 비밀번호를 받아 변경.
export async function POST(req: Request) {
  if (!(await rateLimit("reset", clientIp(req))))
    return NextResponse.json({ error: "요청이 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });

  const b = await req.json().catch(() => ({}));
  const raw = (b.token || "").trim();
  const password = b.password || "";

  if (!raw) return NextResponse.json({ error: "유효하지 않은 링크입니다." }, { status: 400 });
  if (password.length < 4) return NextResponse.json({ error: "비밀번호는 4자 이상" }, { status: 400 });

  const token = await prisma.token.findUnique({ where: { tokenHash: hashToken(raw) } });
  if (!token || token.type !== "reset")
    return NextResponse.json({ error: "유효하지 않은 링크입니다." }, { status: 400 });
  if (token.expiresAt < new Date()) {
    await prisma.token.delete({ where: { id: token.id } }).catch(() => {});
    return NextResponse.json({ error: "링크가 만료되었습니다. 다시 요청해 주세요." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: token.userId },
    data: {
      password: await bcrypt.hash(password, 10),
      // 비번 재설정 = 이메일 소유 확인. 미인증 상태였다면 함께 인증 처리.
      emailVerified: new Date(),
    },
  });
  await prisma.token.deleteMany({ where: { userId: token.userId, type: "reset" } });

  return NextResponse.json({ ok: true });
}
