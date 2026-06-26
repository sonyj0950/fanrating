// LCK 팀명 한글 변환 + 라인(role) 코드 변환 + 선수명 정리
// LoL Esports API는 영문 팀 풀네임 / "T1 Doran" 형태의 소환사명 / top·jungle 등의 role을 준다.

// 영문 풀네임 → 한글. 매핑에 없으면 원문 반환.
export const LCK_TEAM_KO: Record<string, string> = {
  "T1": "T1",
  "Gen.G Esports": "젠지",
  "Gen.G": "젠지",
  "Hanwha Life Esports": "한화생명",
  "Dplus KIA": "디플러스 기아",
  "DWG KIA": "디플러스 기아",
  "kt Rolster": "KT 롤스터",
  "KT Rolster": "KT 롤스터",
  "NONGSHIM RED FORCE": "농심 레드포스",
  "Nongshim RedForce": "농심 레드포스",
  "DRX": "DRX",
  "BNK FEARX": "BNK 피어엑스",
  "BNK FearX": "BNK 피어엑스",
  "OKSavingsBank BRION": "한진 브리온",
  "HANJIN BRION": "한진 브리온",
  "Hanjin Brion": "한진 브리온",
  "BRION": "브리온",
  "Kwangdong Freecs": "광동 프릭스",
  "DN Freecs": "광동 프릭스",
  "Liiv SANDBOX": "리브 샌드박스",
};

export function teamKo(name?: string | null): string {
  if (!name) return "";
  const n = name.trim();
  return LCK_TEAM_KO[n] ?? n;
}

// LoL Esports role → 우리 라인 코드 (LckLineup.tsx LANE_ALIAS가 인식하는 형태)
export const ROLE_TO_LANE: Record<string, string> = {
  top: "TOP",
  jungle: "JGL",
  mid: "MID",
  middle: "MID",
  bottom: "ADC",
  bot: "ADC",
  support: "SPT",
  utility: "SPT",
};

export function roleToLane(role?: string | null): string {
  if (!role) return "";
  return ROLE_TO_LANE[role.trim().toLowerCase()] ?? role.trim().toUpperCase();
}

// "T1 Doran" → "Doran" (선수명에서 팀 접두 제거)
export function stripTeamPrefix(summoner?: string | null, teamCode?: string | null): string {
  if (!summoner) return "";
  const s = summoner.trim();
  const sp = s.indexOf(" ");
  if (sp <= 0) return s;
  const first = s.slice(0, sp);
  if (teamCode && first.toLowerCase() === teamCode.trim().toLowerCase()) return s.slice(sp + 1).trim();
  // teamCode를 모를 때: 첫 토큰이 짧은 대문자 약자면(=팀 태그) 제거
  if (!teamCode && first.length <= 4 && first === first.toUpperCase() && /[A-Z]/.test(first))
    return s.slice(sp + 1).trim();
  return s;
}
