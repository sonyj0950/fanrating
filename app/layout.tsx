import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";
import Header from "@/components/Header";
import GoogleTagManager from "@/components/GoogleTagManager";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://fanarena.kr"),
  title: {
    default: "fanarena.kr — 팬 평점 아레나",
    template: "%s · fanarena.kr",
  },
  description: "경기마다 내 평점을 남기고, 팬들이 뽑은 MVP와 순위를 확인하는 스포츠 팬 평점 커뮤니티. EPL·KBO·LCK 선수 평점을 한곳에서.",
  openGraph: {
    title: "fanarena.kr — 팬 평점 아레나",
    description: "팬이 평가하고, 경기가 더 재밌어진다",
    siteName: "fanarena.kr",
    url: "https://fanarena.kr",
    type: "website",
    images: [
      {
        url: "https://fanarena.kr/og.png",
        width: 1200,
        height: 630,
        alt: "fanarena.kr — 팬 평점 아레나",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "fanarena.kr — 팬 평점 아레나",
    description: "팬이 평가하고, 경기가 더 재밌어진다",
    images: ["https://fanarena.kr/og.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: 첫 페인트 전 스크립트가 data-theme을 붙여 서버 마크업과 달라지는 것 허용
    <html lang="ko" suppressHydrationWarning>
      <body>
        {/* 저장된 테마를 첫 페인트 전에 적용 (라이트 모드 FOUC 방지) */}
        <script dangerouslySetInnerHTML={{ __html:
          `try{if(localStorage.getItem("theme")==="light")document.documentElement.dataset.theme="light"}catch(e){}` }} />
        <Providers>
          <Header />
          <main className="max-w-3xl mx-auto px-4 py-6">{children}</main>
          <footer className="max-w-3xl mx-auto px-4 py-6 mt-8 border-t text-center text-xs text-wfaint space-y-1">
            <div className="flex justify-center gap-3">
              <a href="/terms" className="hover:text-wsub underline">이용약관</a>
              <a href="/privacy" className="hover:text-wsub underline">개인정보 처리방침</a>
              <a href="/disclaimer" className="hover:text-wsub underline">면책 조항</a>
            </div>
            <p data-nosnippet>fanarena.kr은 KBO·한국프로축구연맹·라이엇 게임즈·LCK 및 각 구단·선수와 무관한 비공식 팬 사이트이며, 어떤 단체로부터도 후원·보증받지 않습니다. 모든 상표·저작권은 각 권리자에게 있습니다.</p>
            <p className="text-wfaint">© 2026 fanarena.kr · All rights reserved.</p>
          </footer>
        </Providers>
        {process.env.VERCEL_ENV === "production" && <GoogleTagManager />}
      </body>
    </html>
  );
}
