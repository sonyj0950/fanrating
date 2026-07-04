"use client";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export default function Header() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";

  return (
    <header className="bg-paper border-b border-wline sticky top-0 z-40">
      <div className="max-w-3xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span aria-hidden="true"
            className="w-[26px] h-[26px] rounded-lg bg-gold text-deep grid place-items-center text-[15px] font-black leading-none">
            F
          </span>
          <span className="font-extrabold text-lg sm:text-xl tracking-tight text-ink" style={{ letterSpacing: "-0.5px" }}>
            fanarena<span className="text-wfaint">.kr</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1.5 sm:gap-3 text-sm shrink-0">
          <Link href="/rankings" className="px-1.5 sm:px-2 py-1.5 font-bold text-wsub hover:text-ink transition">
            랭킹
          </Link>
          <Link href="/weekly" className="px-1.5 sm:px-2 py-1.5 font-bold text-wsub hover:text-ink transition whitespace-nowrap">
            주간 베스트
          </Link>
          {isAdmin && (
            <>
              <Link href="/admin" className="px-2 sm:px-3 py-1.5 rounded border border-blue-200 text-blue-700 bg-blue-50">
                관리자
              </Link>
              <Link href="/admin/reports" className="px-2 sm:px-3 py-1.5 rounded border border-red-200 text-red-600 bg-red-50">
                신고
              </Link>
              <Link href="/admin/stats" className="px-2 sm:px-3 py-1.5 rounded border border-green-200 text-green-700 bg-green-50">
                통계
              </Link>
              <Link href="/admin/logs" className="px-2 sm:px-3 py-1.5 rounded border border-gray-200 text-gray-600 bg-gray-50">
                로그
              </Link>
            </>
          )}
          {session ? (
            <>
              <Link href={`/u/${(session.user as any).id}`} className="text-wsub hidden sm:inline hover:text-ink">{session.user?.name}님</Link>
              <button onClick={() => signOut({ callbackUrl: "/" })}
                className="px-2.5 sm:px-3.5 py-1 rounded-full border-[1.5px] border-wline text-wsub font-semibold hover:border-ink hover:text-ink transition">로그아웃</button>
            </>
          ) : (
            <Link href="/login" className="px-2.5 sm:px-3.5 py-1 rounded-full border-[1.5px] border-ink text-ink font-bold hover:bg-ink hover:text-paper transition">로그인</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
