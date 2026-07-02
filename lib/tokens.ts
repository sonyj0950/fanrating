import { randomBytes, createHash } from "crypto";

// 원문 토큰은 이메일 링크로만 전달하고, DB에는 sha256 해시만 저장한다.
// (DB가 유출돼도 링크를 역산할 수 없게)
export function createToken() {
  const raw = randomBytes(32).toString("hex");
  return { raw, hash: hashToken(raw) };
}

export function hashToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

// 사이트 기본 URL (링크 생성용). NEXTAUTH_URL 재활용, 없으면 로컬.
export function baseUrl() {
  return (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
}
