import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { rateLimit } from "./rateLimit";

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
        if (!user) return null;
        const ok = await bcrypt.compare(creds.password, user.password);
        if (!ok) return null;
        return { id: user.id, name: user.nickname, role: user.role } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
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
