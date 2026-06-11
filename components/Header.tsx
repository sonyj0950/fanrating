"use client";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export default function Header() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";

  return (
    <header className="bg-white border-b sticky top-0 z-40">
      <div className="max-w-3xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
        <Link href="/" className="flex items-center gap-1.5 font-bold text-base sm:text-lg tracking-tight shrink-0">
          <svg width="26" height="26" viewBox="0 0 120 120" aria-hidden="true">
            <ellipse cx="60" cy="60" rx="58" ry="58" fill="#0a0a0a"/>
            <ellipse cx="60" cy="64" rx="40" ry="34" fill="#ffffff"/>
            <line x1="60" y1="32" x2="60" y2="96" stroke="#1a1a1a" strokeWidth="3"/>
            <circle cx="60" cy="64" r="11" fill="none" stroke="#1a1a1a" strokeWidth="3"/>
            <path d="M30 18 L42 40 L24 40 Z" fill="#ffffff"/>
            <path d="M90 18 L96 40 L78 40 Z" fill="#ffffff"/>
            <path d="M60 57 l2.3 4.7 5.2 .7 -3.8 3.7 .9 5.2 -4.6 -2.5 -4.6 2.5 .9 -5.2 -3.8 -3.7 5.2 -.7 Z" fill="#0a0a0a"/>
          </svg>
          <span>fanarena<span className="text-gray-400">.</span>kr</span>
        </Link>
        <nav className="flex items-center gap-1.5 sm:gap-3 text-sm shrink-0">
          {isAdmin && (
            <>
              <Link href="/admin" className="px-2 sm:px-3 py-1.5 rounded border border-blue-200 text-blue-700 bg-blue-50">
                관리자
              </Link>
              <Link href="/admin/reports" className="px-2 sm:px-3 py-1.5 rounded border border-red-200 text-red-600 bg-red-50">
                신고
              </Link>
            </>
          )}
          {session ? (
            <>
              <Link href="/account" className="text-gray-500 hidden sm:inline hover:text-blue-600">{session.user?.name}님</Link>
              <button onClick={() => signOut({ callbackUrl: "/" })}
                className="px-2 sm:px-3 py-1.5 rounded border">로그아웃</button>
            </>
          ) : (
            <Link href="/login" className="px-2 sm:px-3 py-1.5 rounded bg-blue-600 text-white">로그인</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
