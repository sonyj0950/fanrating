import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "fanarena.kr — 팬 평점 아레나";

// 아레나 마크 (검정)
function ArenaMark() {
  return (
    <svg width="270" height="270" viewBox="0 0 120 120">
      <ellipse cx="60" cy="60" rx="58" ry="58" fill="#0a0a0a" />
      <ellipse cx="60" cy="64" rx="40" ry="34" fill="#ffffff" />
      <rect x="58.5" y="32" width="3" height="64" fill="#1a1a1a" />
      <circle cx="60" cy="64" r="11" fill="none" stroke="#1a1a1a" strokeWidth="3" />
      <path d="M30 18 L42 40 L24 40 Z" fill="#0a0a0a" />
      <path d="M90 18 L96 40 L78 40 Z" fill="#0a0a0a" />
      <path d="M60 57 l2.3 4.7 5.2 .7 -3.8 3.7 .9 5.2 -4.6 -2.5 -4.6 2.5 .9 -5.2 -3.8 -3.7 5.2 -.7 Z" fill="#0a0a0a" />
    </svg>
  );
}

export default function Image() {
  return new ImageResponse(
    (
      <div style={{
        width: "100%", height: "100%", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 8,
        background: "#ffffff", fontFamily: "sans-serif",
      }}>
        <ArenaMark />
        <div style={{ display: "flex", fontSize: 92, fontWeight: 800, color: "#0a0a0a", marginTop: 8 }}>
          fanarena<span style={{ color: "#9ca3af" }}>.</span>kr
        </div>
        <div style={{ fontSize: 36, fontWeight: 600, color: "#2563eb", marginTop: 4 }}>
          팬이 평가하고, 경기가 더 재밌어진다
        </div>
        <div style={{ fontSize: 26, fontWeight: 500, color: "#6b7280", marginTop: 8 }}>
          야구 · 축구 · LCK 선수 팬 평점
        </div>
      </div>
    ),
    size
  );
}
