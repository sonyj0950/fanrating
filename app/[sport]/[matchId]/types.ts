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
};

export type Agg = Record<string, Record<string, { avg: number; count: number }>>;
