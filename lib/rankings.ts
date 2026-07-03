import { prisma } from "@/lib/prisma";

// 선수 누적 평점 랭킹 — 종목별 시즌 윈도우 내 Rating을 선수 단위로 집계.
// 시즌 평균은 전체 평점의 단순 평균(참여 많은 경기가 자연 가중), 최근 폼은 최근 5경기의 경기별 평균의 평균.

export type RankingRow = {
  playerId: string;
  name: string;
  team: string;
  position: string | null;
  games: number;       // 평가가 달린 경기 수
  ratingCount: number; // 총 평가 수 (세그먼트 포함)
  avg: number;         // 시즌 평균
  recentAvg: number;   // 최근 5경기 평균 (경기별 평균의 평균)
};

export const RANKING_SPORTS = ["epl", "kleague", "kbo", "lck"] as const;

// A매치(국가대표 친선·월드컵 등)는 클럽 시즌 단위 집계와 성격이 달라 랭킹·선수 프로필에서 제외
export function isNationalTeamMatch(m: { homeTeam: string; awayTeam: string; round?: string | null }): boolean {
  if (m.round && /월드컵|A매치|국가대표|아시안컵/.test(m.round)) return true;
  return m.homeTeam === "대한민국" || m.awayTeam === "대한민국";
}

const KST = 9 * 3600 * 1000;

// KST 기준 해당 연·월 1일 0시 → UTC Date
function kstMonthStart(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1) - KST);
}

// 종목별 현재 시즌 시작 시각 (축구 8월~, KBO 3월~, LCK 1월~)
export function seasonStarts(now = new Date()): Record<string, Date> {
  const kst = new Date(now.getTime() + KST);
  const y = kst.getUTCFullYear(), mo = kst.getUTCMonth() + 1;
  const soccerYear = mo >= 8 ? y : y - 1;
  const kboYear = mo >= 3 ? y : y - 1;
  return {
    epl: kstMonthStart(soccerYear, 8),
    kleague: kstMonthStart(soccerYear, 8),
    kbo: kstMonthStart(kboYear, 3),
    lck: kstMonthStart(y, 1),
  };
}

// 종목별 시즌 표기 (예: EPL "2025-26 시즌", KBO "2026 시즌")
export function seasonLabels(now = new Date()): Record<string, string> {
  const kst = new Date(now.getTime() + KST);
  const y = kst.getUTCFullYear(), mo = kst.getUTCMonth() + 1;
  const soccerYear = mo >= 8 ? y : y - 1;
  const soccer = `${soccerYear}-${String((soccerYear + 1) % 100).padStart(2, "0")} 시즌`;
  return {
    epl: soccer,
    kleague: soccer,
    kbo: `${mo >= 3 ? y : y - 1} 시즌`,
    lck: `${y} 시즌`,
  };
}

export async function getRankings(): Promise<Record<string, RankingRow[]>> {
  const starts = seasonStarts();
  const earliest = new Date(Math.min(...Object.values(starts).map(d => d.getTime())));

  const ratings = await prisma.rating.findMany({
    where: { match: { date: { gte: earliest } } },
    select: {
      score: true,
      playerId: true,
      matchId: true,
      match: { select: { sport: true, date: true, homeTeam: true, awayTeam: true, round: true } },
      player: { select: { name: true, team: true, position: true } },
    },
  });

  type Acc = {
    name: string; team: string; position: string | null;
    sum: number; n: number;
    matches: Map<string, { sum: number; n: number; t: number }>;
  };
  const acc: Record<string, Map<string, Acc>> = {};

  for (const r of ratings) {
    const sport = r.match.sport;
    const start = starts[sport];
    if (!start || r.match.date < start) continue;
    if (isNationalTeamMatch(r.match)) continue;
    const perSport = (acc[sport] ||= new Map());
    let a = perSport.get(r.playerId);
    if (!a) {
      a = { name: r.player.name, team: r.player.team, position: r.player.position, sum: 0, n: 0, matches: new Map() };
      perSport.set(r.playerId, a);
    }
    a.sum += r.score;
    a.n++;
    const m = a.matches.get(r.matchId);
    if (m) { m.sum += r.score; m.n++; }
    else a.matches.set(r.matchId, { sum: r.score, n: 1, t: r.match.date.getTime() });
  }

  const bySport: Record<string, RankingRow[]> = {};
  for (const sport of RANKING_SPORTS) {
    const rows: RankingRow[] = [];
    (acc[sport] ?? new Map<string, Acc>()).forEach((a, playerId) => {
      const recent = Array.from(a.matches.values()).sort((x, y) => y.t - x.t).slice(0, 5);
      const recentAvg = recent.reduce((s, m) => s + m.sum / m.n, 0) / recent.length;
      rows.push({
        playerId,
        name: a.name,
        team: a.team,
        position: a.position,
        games: a.matches.size,
        ratingCount: a.n,
        avg: Number((a.sum / a.n).toFixed(2)),
        recentAvg: Number(recentAvg.toFixed(2)),
      });
    });
    rows.sort((x, y) => y.avg - x.avg || y.ratingCount - x.ratingCount);
    bySport[sport] = rows;
  }
  return bySport;
}
