import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "fanarena.kr — 팬 평점 아레나";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{
        width: "100%", height: "100%", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 24,
        background: "linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)", color: "#fff",
        fontFamily: "sans-serif",
      }}>
        <div style={{ fontSize: 88, fontWeight: 800, display: "flex" }}>
          🏟️ fanarena<span style={{ color: "#60a5fa" }}>.</span>kr
        </div>
        <div style={{ fontSize: 38, opacity: 0.85 }}>⚾ 야구 · ⚽ 축구 · 🎮 LCK 선수 팬 평점</div>
      </div>
    ),
    size
  );
}
