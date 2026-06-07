import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "fanarena.kr",
  description: "fan.arena — 야구·축구·LCK 팬 평점 아레나",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <Providers>
          <Header />
          <main className="max-w-3xl mx-auto px-4 py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
