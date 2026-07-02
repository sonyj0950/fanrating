// 요청 제한 (Upstash Redis). 환경변수가 없으면 항상 통과시켜(=degrade) 앱이 죽지 않게 한다.
// Vercel 서버리스는 인스턴스가 여러 개라 메모리 카운터가 부정확 → Redis가 유일한 정확한 무료 방식.
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

type Kind = "login" | "register" | "reset" | "write";

// 종류별 정책: (허용 횟수, 시간창)
const POLICY: Record<Kind, [number, `${number} ${"s" | "m" | "h"}`]> = {
  login: [8, "10 m"],     // 로그인 시도: 10분당 8회
  register: [5, "1 h"],   // 가입: 1시간당 5회
  reset: [4, "1 h"],      // 비번찾기/재설정 요청: 1시간당 4회
  write: [30, "1 m"],     // 평점·코멘트 등 작성: 1분당 30회
};

const limiters: Partial<Record<Kind, Ratelimit>> = {};
if (redis) {
  (Object.keys(POLICY) as Kind[]).forEach((k) => {
    const [n, w] = POLICY[k];
    limiters[k] = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(n, w),
      prefix: `rl:${k}`,
    });
  });
}

// 성공 시 true. 미설정(degrade) 시에도 true.
export async function rateLimit(kind: Kind, identifier: string): Promise<boolean> {
  const l = limiters[kind];
  if (!l) return true;
  try {
    const { success } = await l.limit(identifier);
    return success;
  } catch {
    return true; // Redis 장애 시 서비스는 막지 않는다
  }
}

// 요청에서 클라이언트 IP 추출 (Vercel/프록시 헤더 기준)
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
