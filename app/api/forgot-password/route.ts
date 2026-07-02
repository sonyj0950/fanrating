import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createToken, baseUrl } from "@/lib/tokens";
import { sendPasswordResetEmail } from "@/lib/email";
import { rateLimit, clientIp } from "@/lib/rateLimit";

// 비밀번호 재설정 요청: 이메일을 받아 재설정 링크를 발송.
// 계정 존재 여부를 노출하지 않도록 항상 ok로 응답.
export async function POST(req: Request) {
  if (!(await rateLimit("reset", clientIp(req))))
    return NextResponse.json({ error: "요청이 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });

  const b = await req.json().catch(() => ({}));
  const email = (b.email || "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "이메일을 입력해 주세요." }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    await prisma.token.deleteMany({ where: { userId: user.id, type: "reset" } });
    const { raw, hash } = createToken();
    await prisma.token.create({
      data: {
        userId: user.id,
        tokenHash: hash,
        type: "reset",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1시간
      },
    });
    await sendPasswordResetEmail(email, `${baseUrl()}/reset-password?token=${raw}`);
  }

  return NextResponse.json({ ok: true });
}
