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

// 솔리드 팀 배지 글자색: 밝은 구단색(하늘색·노랑 등)은 잉크, 어두우면 흰색
export function badgeTextColor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#fff";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  // 상대 휘도(간이) — 0.6 이상이면 밝은 색으로 판단
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum >= 0.6 ? "#1a1a1a" : "#fff";
}

// 긴 팀명의 배지 약칭 (명시 우선)
const BADGE_ABBR: Record<string, string> = {
  "디플러스 기아": "DK", "한진 브리온": "BRO", "농심 레드포스": "NS",
  "BNK 피어엑스": "BFX", "KT 롤스터": "KT", 한화생명: "HLE",
  대한민국: "KOR",
};

// 팀 배지 라벨: 명시 약칭 > 3글자 이하 그대로 > 짧은 첫 단어 > 앞 2글자
// (예: 두산, T1, 토트넘 → 그대로 / 한진 브리온 → 한진 / 한화생명 → HLE)
export function badgeLabel(team: string): string {
  const t = team.trim();
  if (BADGE_ABBR[t]) return BADGE_ABBR[t];
  const compact = t.replace(/\s+/g, "");
  if (compact.length <= 3) return compact;
  const first = t.split(/\s+/)[0];
  if (first.length >= 2 && first.length <= 3) return first;
  return compact.slice(0, 2);
}
