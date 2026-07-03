import { ImageResponse } from "next/og";
import { loadShareFonts, LogoMark } from "@/lib/shareCardImage";

// 사이트 대표 OG 이미지 (1200×630) — 3안 크림 & 잉크, 새 로고 마크.
// layout.tsx 메타데이터와 공유카드 폴백이 /og.png를 참조한다.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#f7f5ef",
          color: "#1a1a1a",
          fontFamily: "Pretendard",
        }}
      >
        <LogoMark size={150} />
        <div style={{ display: "flex", alignItems: "baseline", marginTop: 44, fontSize: 92, fontWeight: 700, letterSpacing: -2 }}>
          fanarena<span style={{ color: "#a49d8b" }}>.kr</span>
        </div>
        <div style={{ display: "flex", marginTop: 26, fontSize: 34, fontWeight: 700, color: "#8a6d00" }}>
          팬이 평가하고, 경기가 더 재밌어진다
        </div>
        <div style={{ display: "flex", marginTop: 16, fontSize: 24, color: "#8d8672" }}>
          야구 · 축구 · LCK 선수 팬 평점
        </div>
        <div style={{ display: "flex", position: "absolute", bottom: 0, left: 0, width: "100%", height: 10, background: "#f5b301" }} />
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: loadShareFonts(),
      headers: { "cache-control": "public, max-age=86400, s-maxage=86400" },
    },
  );
}
