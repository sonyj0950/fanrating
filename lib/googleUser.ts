import { prisma } from "./prisma";

// 구글 로그인 유저를 우리 User 테이블에서 찾고, 없으면 생성한다.
// 이메일은 구글이 이미 검증한 값이므로 emailVerified를 바로 채운다.
export async function provisionGoogleUser(rawEmail: string, name?: string | null) {
  const email = rawEmail.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;

  const local = email.split("@")[0] || "user";
  // 닉네임은 NOT NULL·유니크라 임시값을 넣고, 첫 로그인 후 유저가 직접 설정하도록 유도한다.
  const nickname = await uniqueField("nickname", cleanName(name || local));
  const username = await uniqueField("username", cleanName(`g_${local}`));
  const count = await prisma.user.count();

  try {
    return await prisma.user.create({
      data: {
        email,
        username,
        nickname,
        password: null,
        emailVerified: new Date(), // 구글이 검증한 이메일
        nicknameSet: false,        // 아직 유저가 닉네임을 정하지 않음 → /welcome로 유도
        role: count === 0 ? "admin" : "user",
      },
    });
  } catch {
    // 동시 로그인 등으로 이미 생성된 경우 재조회
    const again = await prisma.user.findUnique({ where: { email } });
    if (again) return again;
    throw new Error("google user provisioning failed");
  }
}

function cleanName(s: string) {
  const base = (s || "user").replace(/\s+/g, "").slice(0, 8);
  return base.length >= 2 ? base : "user";
}

// nickname/username 유니크 보장 (충돌 시 숫자 접미사)
async function uniqueField(field: "nickname" | "username", base: string) {
  let candidate = base;
  for (let i = 0; i < 30; i++) {
    const hit = await prisma.user.findUnique({ where: { [field]: candidate } as any });
    if (!hit) return candidate;
    candidate = `${base}${Math.floor(1000 + Math.random() * 9000)}`.slice(0, 12);
  }
  return `${base}${Date.now()}`.slice(0, 14);
}
