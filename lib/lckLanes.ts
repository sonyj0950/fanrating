// LCK 수동 입력용 — 팀 목록(한글 표준값)과 라인 코드. (lckMapping의 ROLE_TO_LANE와 동일 코드)
export const LCK_TEAMS = ["T1", "젠지", "한화생명", "디플러스 기아", "KT", "농심 레드포스", "DRX", "BNK 피어엑스", "한진 브리온", "광동 프릭스"] as const;

export const LCK_LANES = [
  { code: "TOP", label: "탑" },
  { code: "JGL", label: "정글" },
  { code: "MID", label: "미드" },
  { code: "ADC", label: "원딜" },
  { code: "SPT", label: "서폿" },
] as const;

export const LANE_CODES = LCK_LANES.map(l => l.code);
