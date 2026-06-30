// LCK 수동 입력용 — 팀 목록(한글 표준값)과 라인 코드. (lckMapping의 ROLE_TO_LANE와 동일 코드)
export const LCK_TEAMS = ["T1", "젠지", "한화생명", "디플러스 기아", "KT 롤스터", "농심 레드포스", "KRX", "BNK 피어엑스", "한진 브리온", "DN 수퍼스"] as const;

export const LCK_LANES = [
  { code: "TOP", label: "탑" },
  { code: "JGL", label: "정글" },
  { code: "MID", label: "미드" },
  { code: "ADC", label: "원딜" },
  { code: "SPT", label: "서폿" },
] as const;

export const LANE_CODES = LCK_LANES.map(l => l.code);

// 라인 표기 표준화 — role/position에 들어오는 온갖 변형을 표준 코드로.
// (수동 입력·API·LoL Esports가 TOP/Top/JGL/Jungle/Ad/ADC/Bot/SPT/Sup 등 제각각으로 줌)
export const LANE_ALIAS: Record<string, string> = {
  TOP: "TOP", 탑: "TOP",
  JGL: "JGL", JG: "JGL", JUNGLE: "JGL", 정글: "JGL",
  MID: "MID", MIDDLE: "MID", 미드: "MID",
  ADC: "ADC", AD: "ADC", BOT: "ADC", BOTTOM: "ADC", 원딜: "ADC", 바텀: "ADC",
  SPT: "SPT", SUP: "SPT", SUPPORT: "SPT", UTILITY: "SPT", 서폿: "SPT", 서포터: "SPT",
};

export function normalizeLane(raw?: string | null): string {
  if (!raw) return "ETC";
  const key = raw.trim().toUpperCase().replace(/\s+/g, "");
  return LANE_ALIAS[key] || LANE_ALIAS[raw.trim()] || "ETC";
}
