// EPL 팀·선수 한글 변환 + 포지션 변환
// 팀: 2022~2024 시즌에 EPL에 있던 클럽들 (네이버 스포츠 표기 기준)
// 선수: 주요 선수만 한글, 없으면 영어 그대로 반환

export const EPL_TEAM_KO: Record<string, string> = {
  "Arsenal": "아스널",
  "Aston Villa": "아스톤 빌라",
  "Bournemouth": "본머스",
  "AFC Bournemouth": "본머스",
  "Brentford": "브렌트포드",
  "Brighton": "브라이턴",
  "Brighton & Hove Albion": "브라이턴",
  "Burnley": "번리",
  "Chelsea": "첼시",
  "Crystal Palace": "크리스탈 팰리스",
  "Everton": "에버턴",
  "Fulham": "풀럼",
  "Ipswich": "입스위치 타운",
  "Ipswich Town": "입스위치 타운",
  "Leeds": "리즈 유나이티드",
  "Leeds United": "리즈 유나이티드",
  "Leicester": "레스터 시티",
  "Leicester City": "레스터 시티",
  "Liverpool": "리버풀",
  "Luton": "루턴 타운",
  "Luton Town": "루턴 타운",
  "Manchester City": "맨체스터 시티",
  "Manchester United": "맨체스터 유나이티드",
  "Newcastle": "뉴캐슬 유나이티드",
  "Newcastle United": "뉴캐슬 유나이티드",
  "Nottingham Forest": "노팅엄 포레스트",
  "Sheffield Utd": "셰필드 유나이티드",
  "Sheffield United": "셰필드 유나이티드",
  "Southampton": "사우샘프턴",
  "Tottenham": "토트넘 홋스퍼",
  "Tottenham Hotspur": "토트넘 홋스퍼",
  "West Ham": "웨스트햄 유나이티드",
  "West Ham United": "웨스트햄 유나이티드",
  "Wolves": "울버햄튼",
  "Wolverhampton Wanderers": "울버햄튼",
};

export function teamKo(name: string): string {
  if (!name) return name;
  return EPL_TEAM_KO[name.trim()] ?? name.trim();
}

// 주요 선수만 한글 (네이버 스포츠 표기 기준). 없으면 영어 그대로.
// API는 보통 "F. Lastname" 또는 "Firstname Lastname" 형태로 줌 — 둘 다 키로 등록.
export const EPL_PLAYER_KO: Record<string, string> = {
  // 한국 선수
  "Son Heung-Min": "손흥민",
  "Heung-Min Son": "손흥민",
  "Hwang Hee-Chan": "황희찬",
  "Hee-Chan Hwang": "황희찬",
  "Kim Ji-Soo": "김지수",
  // 맨시티
  "Erling Haaland": "홀란드",
  "E. Haaland": "홀란드",
  "Kevin De Bruyne": "더브라위너",
  "K. De Bruyne": "더브라위너",
  "Phil Foden": "포든",
  "P. Foden": "포든",
  "Rodri": "로드리",
  "Bernardo Silva": "베르나르두 실바",
  "B. Silva": "베르나르두 실바",
  // 아스널
  "Bukayo Saka": "사카",
  "B. Saka": "사카",
  "Martin Ødegaard": "외데고르",
  "M. Ødegaard": "외데고르",
  "Gabriel Jesus": "가브리에우 제주스",
  "G. Jesus": "가브리에우 제주스",
  "Declan Rice": "라이스",
  "D. Rice": "라이스",
  // 리버풀
  "Mohamed Salah": "살라",
  "M. Salah": "살라",
  "Virgil van Dijk": "반다이크",
  "V. van Dijk": "반다이크",
  "Darwin Núñez": "누녜스",
  "D. Núñez": "누녜스",
  "Luis Díaz": "루이스 디아스",
  "L. Díaz": "루이스 디아스",
  "Alisson": "알리송",
  // 맨유
  "Bruno Fernandes": "브루누 페르난드스",
  "B. Fernandes": "브루누 페르난드스",
  "Marcus Rashford": "래시포드",
  "M. Rashford": "래시포드",
  "Casemiro": "카세미루",
  "Rasmus Højlund": "호이룬드",
  "R. Højlund": "호이룬드",
  // 첼시
  "Cole Palmer": "팔머",
  "C. Palmer": "팔머",
  "Enzo Fernández": "엔소 페르난데스",
  "E. Fernández": "엔소 페르난데스",
  // 토트넘
  "James Maddison": "매디슨",
  "J. Maddison": "매디슨",
  "Dejan Kulusevski": "쿨루셉스키",
  "D. Kulusevski": "쿨루셉스키",
  // 뉴캐슬
  "Alexander Isak": "이사크",
  "A. Isak": "이사크",
  "Bruno Guimarães": "브루누 기마랑이스",
  "B. Guimarães": "브루누 기마랑이스",
};

export function playerKo(name: string): string {
  // 선수 이름은 전부 영어로 통일 (한글 변환하지 않음)
  return (name || "").trim();
}

// API-Football 포지션(G/D/M/F) → 우리 그룹(GK/DF/MF/FW)
export function posKo(pos: string | null | undefined): string {
  switch ((pos || "").toUpperCase()) {
    case "G": return "GK";
    case "D": return "DF";
    case "M": return "MF";
    case "F": return "FW";
    default: return "";
  }
}

// API-Football grid("row:col")를 우리 피치 좌표(posX/posY, flip=false 기준)로 변환
// grid: row 1 = 자기 골대 쪽, 위로 갈수록 증가 / col = 왼→오
// side: "home"(하단) | "away"(상단)
function toPitchLocal(x: number, y: number, side: "home" | "away") {
  if (side === "home") return { posX: x, posY: 99 - y * 0.49 };
  return { posX: 100 - x, posY: 1 + y * 0.49 };
}

// 한 팀 선발의 grid 배열을 받아 각 선수의 posX/posY를 계산
// rows: [{row, col}], 반환: 같은 순서의 [{posX, posY}|null]
export function gridsToPositions(
  grids: ({ row: number; col: number } | null)[],
  side: "home" | "away"
): ({ posX: number; posY: number } | null)[] {
  const valid = grids.filter((g): g is { row: number; col: number } => !!g);
  if (!valid.length) return grids.map(() => null);
  const maxRow = Math.max(...valid.map(g => g.row));
  // 행별 인원 수
  const perRow: Record<number, number> = {};
  for (const g of valid) perRow[g.row] = (perRow[g.row] || 0) + 1;
  return grids.map(g => {
    if (!g) return null;
    const colsInRow = perRow[g.row] || 1;
    const x = (g.col / (colsInRow + 1)) * 100;                 // 왼→오 균등 분배
    const y = maxRow > 1 ? ((g.row - 1) / (maxRow - 1)) * 90 + 5 : 50; // 골대→상대
    return toPitchLocal(x, y, side);
  });
}

export function parseGrid(grid: string | null | undefined): { row: number; col: number } | null {
  if (!grid || typeof grid !== "string") return null;
  const m = grid.split(":");
  if (m.length !== 2) return null;
  const row = parseInt(m[0], 10), col = parseInt(m[1], 10);
  if (isNaN(row) || isNaN(col)) return null;
  return { row, col };
}
