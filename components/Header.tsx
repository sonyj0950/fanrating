"use client";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export default function Header() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";

  return (
    <header className="bg-white border-b sticky top-0 z-40">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg tracking-tight">
          🏟️ fanarena.kr
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          {isAdmin && (
            <Link href="/admin" className="px-3 py-1.5 rounded border border-blue-200 text-blue-700 bg-blue-50">
              관리자
            </Link>
          )}
          {session ? (
            <>
              <span className="text-gray-500 hidden sm:inline">{session.user?.name}님</span>
              <button onClick={() => signOut({ callbackUrl: "/" })}
                className="px-3 py-1.5 rounded border">로그아웃</button>
            </>
          ) : (
            <Link href="/login" className="px-3 py-1.5 rounded bg-blue-600 text-white">로그인</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
