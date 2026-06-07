export type Player = {
  mpId: string;
  playerId: string;
  name: string;
  team: string;
  role: string;
  isDefault: boolean;
  segment: string; // all | first | second
  avg: number | null;
  count: number;
};

export type Agg = Record<string, Record<string, { avg: number; count: number }>>;
