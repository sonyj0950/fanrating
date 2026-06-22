"use client";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export default function Header() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";

  return (
    <header className="bg-white border-b sticky top-0 z-40">
      <div className="max-w-3xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <svg width="34" height="34" viewBox="0 0 38 38" aria-hidden="true">
            <rect x="1.5" y="1.5" width="35" height="35" rx="11" fill="#f4efe2" stroke="#1a1a1a" strokeWidth="2"/>
            <text x="16.5" y="27.5" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="25" fontWeight="800"
              fill="#1a1a1a" stroke="#1a1a1a" strokeWidth="1.3" strokeLinejoin="round" paintOrder="stroke">F</text>
            <g transform="translate(29,10) scale(0.46)">
              <path d="M0,-8 L1.8,-2.5 L7.6,-2.5 L2.9,1 L4.7,6.5 L0,3.2 L-4.7,6.5 L-2.9,1 L-7.6,-2.5 L-1.8,-2.5 Z"
                fill="#f5b301" stroke="#1a1a1a" strokeWidth="0.5"/>
            </g>
          </svg>
          <span className="font-extrabold text-lg sm:text-xl tracking-tight text-gray-900"
            style={{ WebkitTextStroke: "0.4px #111827", letterSpacing: "-0.5px" }}>
            fanarena<span className="text-gray-400" style={{ WebkitTextStroke: "0.4px #9ca3af" }}>.kr</span>
          </span>
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
