// 구단 색상 — 공식색(기본) + 관리자 오버라이드.
// team 문자열(약칭/한글 표준값) → 대표 색(hex). 마커 테두리/점 등에 사용.

export const OFFICIAL_TEAM_COLORS: Record<string, string> = {
  // ⚾ KBO
  LG: "#C30452", 한화: "#FC4E00", KIA: "#EA0029", 삼성: "#074CA1", 두산: "#1A1748",
  KT: "#000000", SSG: "#CE0E2D", 롯데: "#041E42", NC: "#315288", 키움: "#570514",
  // 🎮 LCK (KBO와 키 충돌 없게 LCK는 고유 팀명 사용)
  T1: "#E2012D", 젠지: "#8A6D2F", 한화생명: "#FF6600", "디플러스 기아": "#0A4DA2",
  "KT 롤스터": "#D11C2A", "농심 레드포스": "#E4002B", KRX: "#2F5DA8",
  "BNK 피어엑스": "#0A8C8A", "한진 브리온": "#00543D", "DN 수퍼스": "#E95513",
  // LCK 약칭 별칭 (수동 입력에서 흔히 쓰는 영문 약칭. KT는 KBO와 충돌해 제외)
  Gen: "#8A6D2F", "Gen.G": "#8A6D2F", GEN: "#8A6D2F", DK: "#0A4DA2", HLE: "#FF6600",
  NS: "#E4002B", BRO: "#00543D", KDF: "#E95513", BFX: "#0A8C8A",
};

// 색이 없는 팀(주로 EPL·국대)용 홈/원정 기본 색 — 한 화면에 두 팀일 때 구분용
export const DEFAULT_HOME = "#2563EB"; // 파랑
export const DEFAULT_AWAY = "#DC2626"; // 빨강

// 오버라이드 > 공식색 > 폴백 순으로 팀 색 해석
export function teamColor(
  team: string | undefined | null,
  overrides?: Record<string, string>,
  fallback: string = DEFAULT_HOME,
): string {
  if (!team) return fallback;
  return overrides?.[team] ?? OFFICIAL_TEAM_COLORS[team] ?? fallback;
}

// 평점 마커(흰 원)의 팀색 링 + 살짝의 그림자
export function ringShadow(color: string): string {
  return `0 0 0 2.5px ${color}, 0 1px 4px rgba(0,0,0,.28)`;
}
