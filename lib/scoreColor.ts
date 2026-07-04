// 평점 점수 → 색상. 1~3 빨강(부진) · 4~5 주황(아쉬움) · 6~7 초록(좋음) · 8~9 파랑(매우 좋음) · 10 무지개.
// 풋몹·후스코어드 관례와 같은 문법. 개별 점수(정수)는 솔리드 칩, 평균(소수)은 밝은 배경 위 구간 텍스트 색.

export const RAINBOW = "linear-gradient(120deg,#E14B3B,#E6892A,#E8C21E,#5EA23C,#3AA0C8,#8A5CC4)";

// 점수별 솔리드 칩 (배경, 글자) — 구간 안에서 점수가 오를수록 진해짐
const CHIP: Record<number, { bg: string; fg: string }> = {
  1: { bg: "#a93226", fg: "#ffffff" },
  2: { bg: "#c0392b", fg: "#ffffff" },
  3: { bg: "#d14e3b", fg: "#ffffff" },
  4: { bg: "#e08a2c", fg: "#ffffff" },
  5: { bg: "#d97a14", fg: "#ffffff" },
  6: { bg: "#3cb256", fg: "#ffffff" }, // 잔디(#5c8454 탁한 초록)와 겹치지 않게 밝고 쨍한 톤
  7: { bg: "#2f9e48", fg: "#ffffff" },
  8: { bg: "#2f7fc1", fg: "#ffffff" },
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

// 평균(소수) → 배경 위 텍스트 색 (구간별). 실제 값은 globals.css의 --sc-* 변수가
// 테마(다크/라이트)에 맞게 공급 — DOM 인라인 스타일 전용 (캔버스에서 쓰면 안 됨).
export function scoreTextColor(avg: number): string {
  if (avg >= 9.75) return "var(--sc-gold)";   // 만점권 (골드)
  if (avg >= 7.5) return "var(--sc-blue)";    // 파랑 (8~9)
  if (avg >= 5.5) return "var(--sc-green)";   // 초록 (6~7)
  if (avg >= 3.5) return "var(--sc-orange)";  // 주황 (4~5)
  return "var(--sc-red)";                     // 빨강 (1~3)
}
