import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken, baseUrl } from "@/lib/tokens";

// 이메일 인증 링크 진입점 (GET). 성공/실패 후 로그인 페이지로 리다이렉트.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("token") || "";
  const to = (status: string) => NextResponse.redirect(`${baseUrl()}/login?verify=${status}`);

  if (!raw) return to("invalid");

  const token = await prisma.token.findUnique({ where: { tokenHash: hashToken(raw) } });
  if (!token || token.type !== "verify") return to("invalid");

  if (token.expiresAt < new Date()) {
    await prisma.token.delete({ where: { id: token.id } }).catch(() => {});
    return to("expired");
  }

  await prisma.user.update({
    where: { id: token.userId },
    data: { emailVerified: new Date() },
  });
  // 해당 유저의 verify 토큰 정리
  await prisma.token.deleteMany({ where: { userId: token.userId, type: "verify" } });

  return to("success");
}
