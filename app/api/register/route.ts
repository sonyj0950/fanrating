import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createToken, baseUrl } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/email";
import { rateLimit, clientIp } from "@/lib/rateLimit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 회원가입(아이디·닉네임·이메일·비밀번호) — 첫 번째 가입자는 자동으로 관리자(admin)
// 가입 후 이메일 인증 메일을 발송하고, 인증 전에는 작성 기능이 제한된다.
export async function POST(req: Request) {
  if (!(await rateLimit("register", clientIp(req))))
    return NextResponse.json({ error: "요청이 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });

  const b = await req.json();
  const username = (b.username || "").trim();
  const nickname = (b.nickname || "").trim();
  const email = (b.email || "").trim().toLowerCase();
  const password = b.password || "";

  if (username.length < 2) return NextResponse.json({ error: "아이디는 2자 이상" }, { status: 400 });
  if (nickname.length < 2 || nickname.length > 12)
    return NextResponse.json({ error: "닉네임은 2~12자" }, { status: 400 });
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "올바른 이메일을 입력해 주세요." }, { status: 400 });
  if (password.length < 4) return NextResponse.json({ error: "비밀번호는 4자 이상" }, { status: 400 });

  const idExists = await prisma.user.findUnique({ where: { username } });
  if (idExists) return NextResponse.json({ error: "이미 사용 중인 아이디입니다." }, { status: 400 });
  const nickExists = await prisma.user.findUnique({ where: { nickname } });
  if (nickExists) return NextResponse.json({ error: "이미 사용 중인 닉네임입니다." }, { status: 400 });
  const emailExists = await prisma.user.findUnique({ where: { email } });
  if (emailExists) return NextResponse.json({ error: "이미 사용 중인 이메일입니다." }, { status: 400 });

  const userCount = await prisma.user.count();
  const isFirst = userCount === 0;
  const user = await prisma.user.create({
    data: {
      username,
      nickname,
      email,
      password: await bcrypt.hash(password, 10),
      role: isFirst ? "admin" : "user",
      // 첫 관리자는 인증 절차 없이 바로 사용 가능하게(운영 편의)
      emailVerified: isFirst ? new Date() : null,
    },
  });

  // 인증 메일 발송 (첫 관리자는 생략)
  if (!isFirst) {
    const { raw, hash } = createToken();
    await prisma.token.create({
      data: {
        userId: user.id,
        tokenHash: hash,
        type: "verify",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24시간
      },
    });
    await sendVerificationEmail(email, `${baseUrl()}/api/verify-email?token=${raw}`);
  }

  return NextResponse.json({ ok: true, id: user.id, role: user.role, needsVerification: !isFirst });
}
