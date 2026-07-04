// 평점 점수 → 색상. 1~3 빨강 · 4~5 초록 · 6~9 파랑 · 10 무지개.
// 개별 점수(정수)는 솔리드 칩, 평균(소수)은 밝은 배경 위 구간 텍스트 색.

export const RAINBOW = "linear-gradient(120deg,#E14B3B,#E6892A,#E8C21E,#5EA23C,#3AA0C8,#8A5CC4)";

// 점수별 솔리드 칩 (배경, 글자) — 구간 안에서 점수가 오를수록 진해짐
const CHIP: Record<number, { bg: string; fg: string }> = {
  1: { bg: "#a93226", fg: "#ffffff" },
  2: { bg: "#c0392b", fg: "#ffffff" },
  3: { bg: "#d14e3b", fg: "#ffffff" },
  4: { bg: "#67a844", fg: "#ffffff" },
  5: { bg: "#3b9b4e", fg: "#ffffff" },
  6: { bg: "#4e9ad4", fg: "#ffffff" },
  7: { bg: "#3a86c8", fg: "#ffffff" },
  8: { bg: "#2a6fb2", fg: "#ffffff" },
  9: { bg: "#1c5a9c", fg: "#ffffff" },
};

type ChipStyle = { background: string; color: string; textShadow?: string };

// 점수 칩 인라인 스타일. 만점(정수 10 또는 평균 9.75+)만 무지개 + 글자 그림자.
export function scoreChipStyle(score: number): ChipStyle {
  if (isPerfect(score)) return { background: RAINBOW, color: "#ffffff", textShadow: "0 1px 2px rgba(0,0,0,.5)" };
  const s = Math.max(1, Math.min(9, Math.round(score)));
  const c = CHIP[s];
  return { background: c.bg, color: c.fg };
}

// 만점(무지개) 여부 — 9.75 이상만 (9.5 평균은 초록 유지)
export function isPerfect(score: number): boolean {
  return score >= 9.75;
}

// 평균(소수) → 밝은 배경 위 텍스트 색 (구간별)
export function scoreTextColor(avg: number): string {
  if (avg >= 9.75) return "#8a6d00"; // 만점권 (골드)
  if (avg >= 5.5) return "#2a6fb2";  // 파랑 (6~9)
  if (avg >= 3.5) return "#3b8c4a";  // 초록 (4~5)
  return "#b5533f";                  // 빨강 (1~3)
}
