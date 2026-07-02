import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { rateLimit } from "./rateLimit";
import { provisionGoogleUser } from "./googleUser";

// 구글 OAuth는 환경변수가 있을 때만 활성화 (없으면 아이디/비번만 동작)
const googleEnabled = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "credentials",
      credentials: { username: {}, password: {} },
      async authorize(creds) {
        if (!creds?.username || !creds?.password) return null;
        // 계정별 무차별 대입 방지: 아이디 기준 로그인 시도 제한
        if (!(await rateLimit("login", `u:${creds.username}`))) return null;
        const user = await prisma.user.findUnique({ where: { username: creds.username } });
        if (!user || !user.password) return null; // 구글 전용 계정은 비번 로그인 불가
        const ok = await bcrypt.compare(creds.password, user.password);
        if (!ok) return null;
        return { id: user.id, name: user.nickname, role: user.role } as any;
      },
    }),
    ...(googleEnabled
      ? [Google({
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        })]
      : []),
  ],
  callbacks: {
    // 구글 로그인 시 우리 User 테이블에 없으면 생성
    async signIn({ account, profile }) {
      if (account?.provider === "google") {
        const email = (profile as any)?.email as string | undefined;
        if (!email) return false;
        await provisionGoogleUser(email, (profile as any)?.name);
      }
      return true;
    },
    async jwt({ token, user, account, trigger }) {
      // 아이디/비번 로그인: authorize가 반환한 우리 값 사용
      if (user && (user as any).role) {
        token.id = (user as any).id;
        token.role = (user as any).role;
      }
      // 구글 로그인: 이메일로 우리 유저를 찾아 내부 id/role/닉네임을 토큰에 심음
      if (account?.provider === "google" && token.email) {
        const dbu = await prisma.user.findUnique({ where: { email: token.email } });
        if (dbu) {
          token.id = dbu.id;
          token.role = dbu.role;
          token.name = dbu.nickname;
        }
      }
      // 닉네임 설정 등으로 session.update() 호출 시 DB에서 최신 닉네임 반영
      if (trigger === "update" && token.id) {
        const dbu = await prisma.user.findUnique({ where: { id: token.id as string } });
        if (dbu) { token.name = dbu.nickname; token.role = dbu.role; }
      }
      return token;
    },
    async session({ session, token }) {
      (session.user as any).id = token.id;
      (session.user as any).role = token.role;
      (session.user as any).username = session.user?.name;
      return session;
    },
  },
};
