import { prisma } from "./prisma";

// 작성 액션(평점·코멘트 등) 전에 이메일 인증 여부를 확인.
// 기존 유저(email=null)는 인증 면제 → 신규 유저만 미인증 시 차단.
// 통과면 null, 막아야 하면 사용자에게 보여줄 에러 메시지를 반환.
export async function verificationBlock(userId: string): Promise<string | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, emailVerified: true },
  });
  if (u?.email && !u.emailVerified) {
    return "이메일 인증 후 이용할 수 있습니다. 가입 시 받은 인증 메일을 확인해 주세요.";
  }
  return null;
}
