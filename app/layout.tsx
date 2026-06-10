import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "fanarena.kr",
  description: "fanarena.kr — 야구·축구·LCK 팬 평점 아레나",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <Providers>
          <Header />
          <main className="max-w-3xl mx-auto px-4 py-6">{children}</main>
          <footer className="max-w-3xl mx-auto px-4 py-6 mt-8 border-t text-center text-xs text-gray-400 space-y-1">
            <div className="flex justify-center gap-3">
              <a href="/terms" className="hover:text-gray-600 underline">이용약관</a>
              <a href="/privacy" className="hover:text-gray-600 underline">개인정보 처리방침</a>
            </div>
            <p>fanarena.kr은 KBO·한국프로축구연맹·LCK 및 각 구단·선수와 무관한 비공식 팬 사이트입니다.</p>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
