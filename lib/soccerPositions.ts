// 축구 포지션 정의 — 업로드된 포지션 차트(FullSizeRender) 기준
// 좌표계: 한 팀 기준. x = 0(좌) ~ 100(우), y = 0(자기 골문/GK) ~ 100(상대 골문/공격)
// accent: 차트의 빨강(중앙 척추 라인) / 파랑(하프·윙 포지션) 구분

export type PosAccent = "core" | "wide";
export type PosLine =
  | "GK" | "SW" | "DEF" | "DM" | "MID" | "AM" | "FW" | "SS" | "ST";

export interface PositionDef {
  code: string;     // 포지션 코드 (ST, CM, GK ...)
  x: number;        // 0(좌) ~ 100(우)
  y: number;        // 0(자기 골문) ~ 100(상대 골문)
  line: PosLine;    // 라인 그룹
  lineLabel: string;
  accent: PosAccent; // core=빨강, wide=파랑
}

// 차트 위→아래(공격→수비) 순서대로 정의
export const POSITIONS: PositionDef[] = [
  // 스트라이커
  { code: "LS", x: 37, y: 91, line: "ST", lineLabel: "스트라이커", accent: "wide" },
  { code: "ST", x: 50, y: 91, line: "ST", lineLabel: "스트라이커", accent: "core" },
  { code: "RS", x: 63, y: 91, line: "ST", lineLabel: "스트라이커", accent: "wide" },
  // 세컨드 스트라이커
  { code: "SS", x: 50, y: 84, line: "SS", lineLabel: "세컨톱", accent: "wide" },
  // 포워드 / 윙
  { code: "LW",  x: 15, y: 76, line: "FW", lineLabel: "포워드", accent: "core" },
  { code: "LCF", x: 35, y: 76, line: "FW", lineLabel: "포워드", accent: "wide" },
  { code: "CF",  x: 50, y: 76, line: "FW", lineLabel: "포워드", accent: "core" },
  { code: "RCF", x: 65, y: 76, line: "FW", lineLabel: "포워드", accent: "wide" },
  { code: "RW",  x: 85, y: 76, line: "FW", lineLabel: "포워드", accent: "core" },
  // 공격형 미드필더
  { code: "LAM", x: 33, y: 64, line: "AM", lineLabel: "공격형 MF", accent: "wide" },
  { code: "AM",  x: 50, y: 64, line: "AM", lineLabel: "공격형 MF", accent: "core" },
  { code: "RAM", x: 67, y: 64, line: "AM", lineLabel: "공격형 MF", accent: "wide" },
  // 중앙 미드필더
  { code: "LM",  x: 14,  y: 50, line: "MID", lineLabel: "중앙 MF", accent: "core" },
  { code: "LCM", x: 33, y: 50, line: "MID", lineLabel: "중앙 MF", accent: "wide" },
  { code: "CM",  x: 50, y: 50, line: "MID", lineLabel: "중앙 MF", accent: "core" },
  { code: "RCM", x: 67, y: 50, line: "MID", lineLabel: "중앙 MF", accent: "wide" },
  { code: "RM",  x: 86, y: 50, line: "MID", lineLabel: "중앙 MF", accent: "core" },
  // 수비형 미드필더
  { code: "LWB", x: 15, y: 34, line: "DM", lineLabel: "수비형 MF", accent: "wide" },
  { code: "LDM", x: 34, y: 34, line: "DM", lineLabel: "수비형 MF", accent: "wide" },
  { code: "DM",  x: 50, y: 34, line: "DM", lineLabel: "수비형 MF", accent: "core" },
  { code: "RDM", x: 66, y: 34, line: "DM", lineLabel: "수비형 MF", accent: "wide" },
  { code: "RWB", x: 85, y: 34, line: "DM", lineLabel: "수비형 MF", accent: "wide" },
  // 수비
  { code: "LB",  x: 15, y: 20, line: "DEF", lineLabel: "수비", accent: "core" },
  { code: "LCB", x: 32, y: 20, line: "DEF", lineLabel: "수비", accent: "wide" },
  { code: "CB",  x: 50, y: 20, line: "DEF", lineLabel: "수비", accent: "core" },
  { code: "RCB", x: 68, y: 20, line: "DEF", lineLabel: "수비", accent: "wide" },
  { code: "RB",  x: 85, y: 20, line: "DEF", lineLabel: "수비", accent: "core" },
  // 스위퍼
  { code: "SW",  x: 50, y: 11, line: "SW", lineLabel: "스위퍼", accent: "wide" },
  // 골키퍼
  { code: "GK",  x: 50, y: 4,  line: "GK", lineLabel: "골키퍼", accent: "core" },
];

export const POSITION_MAP: Record<string, PositionDef> =
  Object.fromEntries(POSITIONS.map(p => [p.code, p]));

// 라인 단위로 묶은 목록 (관리자 드롭다운/안내용)
export const POSITIONS_BY_LINE: { line: PosLine; label: string; codes: string[] }[] = (() => {
  const order: PosLine[] = ["ST", "SS", "FW", "AM", "MID", "DM", "DEF", "SW", "GK"];
  return order.map(line => {
    const items = POSITIONS.filter(p => p.line === line);
    return { line, label: items[0].lineLabel, codes: items.map(i => i.code) };
  });
})();

// 한글/자유입력 별칭 → 포지션 코드
const ALIASES: Record<string, string> = {
  "골키퍼": "GK", "키퍼": "GK", "goalkeeper": "GK",
  "스위퍼": "SW", "리베로": "SW",
  "수비": "CB", "수비수": "CB", "센터백": "CB", "중앙수비": "CB",
  "좌측수비": "LB", "우측수비": "RB", "풀백": "LB", "윙백": "RWB",
  "수미": "DM", "수비형미드필더": "DM", "홀딩": "DM",
  "미드": "CM", "미드필더": "CM", "중앙미드필더": "CM", "중미": "CM",
  "공미": "AM", "공격형미드필더": "AM", "플레이메이커": "AM",
  "윙": "LW", "측면": "LW", "윙어": "RW",
  "공격": "ST", "공격수": "ST", "스트라이커": "ST", "최전방": "ST",
  "세컨톱": "SS", "처진공격수": "SS",
};

/**
 * 자유 입력 역할/포지션 문자열을 포지션 코드로 정규화.
 * 매칭 실패 시 null 반환(피치에 배치하지 않고 "미배치" 처리).
 */
export function normalizeRole(role?: string | null): string | null {
  if (!role) return null;
  const raw = role.trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (POSITION_MAP[upper]) return upper;
  // 공백 제거 후 한글 별칭 매칭
  const compact = raw.replace(/\s+/g, "");
  if (ALIASES[compact]) return ALIASES[compact];
  // 문자열 안에 코드가 포함된 경우 (예: "선발 ST", "CM/수비형") — 긴 코드 우선
  const byLen = [...POSITIONS].sort((a, b) => b.code.length - a.code.length);
  const found = byLen.find(p => upper.includes(p.code));
  return found ? found.code : null;
}

// 큰 역할군(GK/DF/MF/FW) → 기본 포지션 코드 (입력 시 자동 배치용)
export const GROUP_DEFAULT: Record<string, string> = {
  GK: "GK", DF: "CB", MF: "CM", FW: "ST",
};

// 팀 로컬 좌표(x:0~100 좌우, y:0 자기골문~100 상대골문)에서 가장 가까운 포지션 코드.
// 드래그로 위치를 옮겼을 때 그 자리에 맞는 세부 포지션으로 자동 변경하는 데 사용.
export function nearestCode(x: number, y: number): string {
  let best = "CM", bestD = Infinity;
  for (const p of POSITIONS) {
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < bestD) { bestD = d; best = p.code; }
  }
  return best;
}
