import { prisma } from "@/lib/prisma";
import { normalizeRole, POSITION_MAP } from "@/lib/soccerPositions";
import { LCK_LANES, normalizeLane } from "@/lib/lckLanes";
import { KBO_BATTER_POSITIONS } from "@/lib/kboTeams";

// 주간 베스트 — 한 주(KST 월~일) 동안의 팬 평점으로 종목별 베스트 라인업 선정.
// 축구: 베스트 XI(4-3-3) · KBO: 선발투수+베스트 나인 · LoL: 라인별 베스트 5.
// 주간 활약 단위라 A매치·국제전도 포함한다 (시즌 누적 랭킹과 다름).

export const WEEKLY_MIN_RATINGS = 3; // 후보 자격: 주간 평가 최소 수

export type BestPick = {
  slot: string; // 슬롯 라벨 (GK · 수비 · 포수 · TOP …)
  playerId: string;
  name: string;
  team: string;
  sport: string;
  avg: number;
  count: number;
};

export type WeeklyRow = { label: string; picks: (BestPick | null)[] };

export type WeeklyBest = {
  offset: number;
  weekLabel: string;
  hasPrev: boolean;
  hasNext: boolean;
  soccer: WeeklyRow[]; // 공격/미드필더/수비/GK — 3-3-4-1
  kbo: WeeklyRow[];    // 선발투수 + 타자 9포지션
  lck: WeeklyRow[];    // 탑/정글/미드/원딜/서폿
};

const KST = 9 * 3600 * 1000;
const WEEK = 7 * 86400000;

// offset=0: 이번 주(월요일~), -1: 지난주 …
export function weekRange(offset = 0): { start: Date; end: Date; label: string } {
  const kstNow = new Date(Date.now() + KST);
  const sinceMon = (kstNow.getUTCDay() + 6) % 7;
  const monUtcMs =
    Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate() - sinceMon) - KST;
  const start = new Date(monUtcMs + offset * WEEK);
  const end = new Date(start.getTime() + WEEK);
  const f = (d: Date) => {
    const k = new Date(d.getTime() + KST);
    return `${k.getUTCMonth() + 1}/${k.getUTCDate()}`;
  };
  return { start, end, label: `${f(start)} ~ ${f(new Date(end.getTime() - 86400000))}` };
}

type Agg = {
  playerId: string; name: string; team: string; sport: string;
  position: string | null; // Player.position (축구는 이쪽이 신뢰 소스)
  sum: number; n: number;
  roles: Map<string, number>; // 그 주에 맡은 역할 빈도 (KBO·LCK 라인업이 신뢰 소스)
};

function pickBest(cands: Agg[], slot: string): BestPick | null {
  let best: Agg | null = null;
  for (const c of cands) {
    if (c.n < WEEKLY_MIN_RATINGS) continue;
    if (!best || c.sum / c.n > best.sum / best.n ||
      (c.sum / c.n === best.sum / best.n && c.n > best.n)) best = c;
  }
  if (!best) return null;
  return {
    slot, playerId: best.playerId, name: best.name, team: best.team, sport: best.sport,
    avg: Number((best.sum / best.n).toFixed(2)), count: best.n,
  };
}

function topRole(a: Agg): string {
  let role = "", max = 0;
  a.roles.forEach((n, r) => { if (n > max) { max = n; role = r; } });
  return role;
}

export async function getWeeklyBest(offset = 0): Promise<WeeklyBest> {
  const { start, end, label } = weekRange(offset);

  const ratings = await prisma.rating.findMany({
    where: { match: { date: { gte: start, lt: end } } },
    select: {
      score: true, playerId: true, matchId: true,
      match: { select: { sport: true } },
      player: { select: { name: true, team: true, position: true } },
    },
  });

  // (matchId, playerId) → 그 경기에서의 역할
  const matchIds = Array.from(new Set(ratings.map(r => r.matchId)));
  const mpRows = matchIds.length
    ? await prisma.matchPlayer.findMany({
        where: { matchId: { in: matchIds } },
        select: { matchId: true, playerId: true, role: true },
      })
    : [];
  const roleOf = new Map<string, string>();
  for (const mp of mpRows) if (mp.role) roleOf.set(`${mp.matchId}:${mp.playerId}`, mp.role);

  // 종목별 선수 집계
  const bySport: Record<string, Map<string, Agg>> = {};
  for (const r of ratings) {
    const sport = r.match.sport === "epl" ? "soccer" : r.match.sport === "kleague" ? "soccer" : r.match.sport;
    const m = (bySport[sport] ||= new Map());
    let a = m.get(r.playerId);
    if (!a) {
      a = { playerId: r.playerId, name: r.player.name, team: r.player.team, sport: r.match.sport,
        position: r.player.position, sum: 0, n: 0, roles: new Map() };
      m.set(r.playerId, a);
    }
    a.sum += r.score; a.n++;
    const role = roleOf.get(`${r.matchId}:${r.playerId}`);
    if (role && role !== "P") a.roles.set(role, (a.roles.get(role) || 0) + 1); // "P"는 우선노출 마커 — 역할 아님
  }

  // ⚽ 축구 베스트 XI — 포지션 라인으로 그룹핑 후 공격 3 / 미드 3 / 수비 4 / GK 1
  const soccerAgg = Array.from((bySport.soccer ?? new Map<string, Agg>()).values());
  const groupOf = (a: Agg): "FW" | "MF" | "DF" | "GK" | null => {
    const code = normalizeRole(a.position) ?? normalizeRole(topRole(a));
    if (!code) return null;
    const line = POSITION_MAP[code]?.line;
    if (line === "GK") return "GK";
    if (line === "DEF" || line === "SW") return "DF";
    if (line === "DM" || line === "MID" || line === "AM") return "MF";
    return "FW"; // ST / SS / FW
  };
  const g: Record<string, Agg[]> = { FW: [], MF: [], DF: [], GK: [] };
  for (const a of soccerAgg) { const grp = groupOf(a); if (grp) g[grp].push(a); }
  const takeTop = (list: Agg[], k: number, slot: string): (BestPick | null)[] => {
    const sorted = list
      .filter(a => a.n >= WEEKLY_MIN_RATINGS)
      .sort((x, y) => y.sum / y.n - x.sum / x.n || y.n - x.n)
      .slice(0, k);
    const picks: (BestPick | null)[] = sorted.map(a => ({
      slot, playerId: a.playerId, name: a.name, team: a.team, sport: a.sport,
      avg: Number((a.sum / a.n).toFixed(2)), count: a.n,
    }));
    while (picks.length < k) picks.push(null);
    return picks;
  };
  const soccer: WeeklyRow[] = [
    { label: "공격", picks: takeTop(g.FW, 3, "FW") },
    { label: "미드필더", picks: takeTop(g.MF, 3, "MF") },
    { label: "수비", picks: takeTop(g.DF, 4, "DF") },
    { label: "골키퍼", picks: takeTop(g.GK, 1, "GK") },
  ];

  // ⚾ KBO — 선발투수 + 베스트 나인 (포지션별 1명)
  const kboAgg = Array.from((bySport.kbo ?? new Map<string, Agg>()).values());
  const kbo: WeeklyRow[] = [{
    label: "베스트 나인",
    picks: [
      pickBest(kboAgg.filter(a => (topRole(a) || a.position) === "투수"), "선발투수"),
      ...KBO_BATTER_POSITIONS.map(pos => pickBest(kboAgg.filter(a => (topRole(a) || a.position) === pos), pos)),
    ],
  }];

  // 🎮 LoL — 라인별 베스트 5
  const lckAgg = Array.from((bySport.lck ?? new Map<string, Agg>()).values());
  const lck: WeeklyRow[] = [{
    label: "베스트 5",
    picks: LCK_LANES.map(l =>
      pickBest(lckAgg.filter(a => normalizeLane(topRole(a) || a.position) === l.code), l.label)),
  }];

  return {
    offset, weekLabel: label,
    hasPrev: offset > -12, // 최근 12주까지 탐색 허용
    hasNext: offset < 0,
    soccer, kbo, lck,
  };
}
