import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createToken, baseUrl } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/email";
import { rateLimit, clientIp } from "@/lib/rateLimit";

// 인증 메일 재발송. 이메일로 요청 (미인증 유저만 대상).
// 존재 여부를 노출하지 않도록 항상 ok로 응답.
export async function POST(req: Request) {
  if (!(await rateLimit("reset", clientIp(req))))
    return NextResponse.json({ error: "요청이 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });

  const b = await req.json().catch(() => ({}));
  const email = (b.email || "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "이메일을 입력해 주세요." }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email } });
  if (user && !user.emailVerified) {
    await prisma.token.deleteMany({ where: { userId: user.id, type: "verify" } });
    const { raw, hash } = createToken();
    await prisma.token.create({
      data: {
        userId: user.id,
        tokenHash: hash,
        type: "verify",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    await sendVerificationEmail(email, `${baseUrl()}/api/verify-email?token=${raw}`);
  }

  return NextResponse.json({ ok: true });
}
