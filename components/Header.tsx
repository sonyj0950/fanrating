"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

// 라이트(세이지) ↔ 다크(미드나잇 그린) 토글 — html[data-theme] + localStorage
function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);
  function toggle() {
    const next = theme === "light" ? "dark" : "light";
    if (next === "light") document.documentElement.dataset.theme = "light";
    else delete document.documentElement.dataset.theme;
    try { localStorage.setItem("theme", next); } catch {}
    setTheme(next);
  }
  return (
    <button onClick={toggle} aria-label={theme === "light" ? "다크 모드로 전환" : "라이트 모드로 전환"}
      className="w-8 h-8 rounded-full border border-wline grid place-items-center text-[14px] text-wsub hover:text-ink hover:border-ink transition shrink-0">
      {theme === "light" ? "🌙" : "☀️"}
    </button>
  );
}

// 통합 내비: 홈 · 축구 · 야구 · LoL · 랭킹 · 주간 베스트
// 종목은 실제 URL(/soccer 등)로 — 경기 상세(/soccer/abc)에서도 해당 종목이 활성으로 보인다.
const NAV: { href: string; label: string; active: (p: string) => boolean }[] = [
  { href: "/", label: "홈", active: p => p === "/" },
  { href: "/soccer", label: "축구", active: p => /^\/(soccer|kleague|epl)(\/|$)/.test(p) },
  { href: "/baseball", label: "야구", active: p => /^\/(baseball|kbo)(\/|$)/.test(p) },
  { href: "/lol", label: "LoL", active: p => /^\/(lol|lck)(\/|$)/.test(p) },
  { href: "/rankings", label: "랭킹", active: p => p.startsWith("/rankings") },
  { href: "/weekly", label: "주간 베스트", active: p => p.startsWith("/weekly") },
];

export default function Header() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";
  const pathname = usePathname() ?? "/";

  return (
    <header className="bg-paper border-b border-wline sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-1.5 sm:gap-2">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span aria-hidden="true"
            className="w-[26px] h-[26px] rounded-lg bg-gold text-deep grid place-items-center text-[15px] font-black leading-none">
            F
          </span>
          {/* 모바일은 로고 텍스트를 숨겨 내비 6개가 들어갈 폭 확보 */}
          <span className="hidden md:inline font-extrabold text-lg sm:text-xl tracking-tight text-ink" style={{ letterSpacing: "-0.5px" }}>
            fanarena<span className="text-wfaint">.kr</span>
          </span>
        </Link>
        <nav className="flex items-center gap-0 sm:gap-1 text-[13px] sm:text-sm min-w-0 overflow-x-auto">
          {NAV.map(n => (
            <Link key={n.href} href={n.href}
              className={`px-1.5 sm:px-2 py-1.5 font-bold whitespace-nowrap transition ${
                n.active(pathname) ? "text-gold" : "text-wsub hover:text-ink"}`}>
              {n.label}
            </Link>
          ))}
          {isAdmin && (
            <>
              <Link href="/admin" className="px-1.5 sm:px-2.5 py-1 ml-1 rounded border border-blue-200 text-blue-700 bg-blue-50 whitespace-nowrap">
                관리자
              </Link>
              <Link href="/admin/reports" className="hidden lg:inline px-2.5 py-1 rounded border border-red-200 text-red-600 bg-red-50 whitespace-nowrap">
                신고
              </Link>
              <Link href="/admin/stats" className="hidden lg:inline px-2.5 py-1 rounded border border-green-200 text-green-700 bg-green-50 whitespace-nowrap">
                통계
              </Link>
              <Link href="/admin/logs" className="hidden lg:inline px-2.5 py-1 rounded border border-gray-200 text-gray-600 bg-gray-50 whitespace-nowrap">
                로그
              </Link>
            </>
          )}
        </nav>
        <div className="flex items-center gap-1.5 sm:gap-3 text-sm shrink-0">
          <ThemeToggle />
          {session ? (
            <>
              <Link href={`/u/${(session.user as any).id}`} className="text-wsub hidden lg:inline hover:text-ink whitespace-nowrap">{session.user?.name}님</Link>
              <button onClick={() => signOut({ callbackUrl: "/" })}
                className="px-2.5 sm:px-3.5 py-1 rounded-full border-[1.5px] border-wline text-wsub font-semibold hover:border-ink hover:text-ink transition whitespace-nowrap">로그아웃</button>
            </>
          ) : (
            <Link href="/login" className="px-2.5 sm:px-3.5 py-1 rounded-full border-[1.5px] border-ink text-ink font-bold hover:bg-ink hover:text-paper transition whitespace-nowrap">로그인</Link>
          )}
        </div>
      </div>
    </header>
  );
}
