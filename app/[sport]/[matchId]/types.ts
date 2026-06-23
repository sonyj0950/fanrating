export type Player = {
  mpId: string;
  playerId: string;
  name: string;
  team: string;
  role: string;
  isDefault: boolean;
  segment: string; // all | first | second
  posX: number | null; // 관리자 커스텀 위치 (%)
  posY: number | null;
  avg: number | null;
  count: number;
  champions?: Record<string, string>; // 🎮 LCK 세트별 챔피언 { set1: "Vayne", ... }
  battingOrder?: number | null; // ⚾ KBO 타순 1~9 (투수·벤치는 null)
  isPitcher?: boolean | null;   // ⚾ KBO 투수 여부
};

export type Agg = Record<string, Record<string, { avg: number; count: number }>>;
