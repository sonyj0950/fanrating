import { prisma } from "@/lib/prisma";
import { Section } from "./MatchCard";
import SportTabs from "./SportTabs";
import { standingsVisibleOnHome } from "@/lib/standings";

export const dynamic = "force-dynamic";

export default async function Home() {
  const raw = await prisma.match.findMany({
    orderBy: { date: "desc" },
    include: { players: { include: { player: true } }, ratings: true },
  });

  const matches = raw.map(m => {
    const agg: Record<string, { sum: number; n: number }> = {};
    for (const r of m.ratings) {
      agg[r.playerId] ||= { sum: 0, n: 0 };
      agg[r.playerId].sum += r.score;
      agg[r.playerId].n++;
    }
    let pog: { name: string; avg: number } | null = null;
    for (const mp of m.players) {
      const a = agg[mp.playerId];
      if (!a) continue;
      const avg = a.sum / a.n;
      if (!pog || avg > pog.avg) pog = { name: mp.player.name, avg: Number(avg.toFixed(1)) };
    }
    return { ...m, pog, ratingCount: m.ratings.length };
  });

  // "오늘"을 한국 시간(KST, UTC+9) 기준으로 계산
  const KST = 9 * 3600 * 1000;
  const kstNow = new Date(Date.now() + KST);
  const y = kstNow.getUTCFullYear(), mo = kstNow.getUTCMonth(), d = kstNow.getUTCDate();
  const start = new Date(Date.UTC(y, mo, d, 0, 0, 0, 0) - KST);
  const end = new Date(Date.UTC(y, mo, d, 23, 59, 59, 999) - KST);

  // 클라이언트로 넘길 슬림 DTO (날짜는 문자열로)
  const slim = (m: any) => ({
    id: m.id, sport: m.sport, date: m.date.toISOString(),
    homeTeam: m.homeTeam, awayTeam: m.awayTeam, homeScore: m.homeScore, awayScore: m.awayScore,
    status: m.status, round: m.round ?? null, pog: m.pog, ratingCount: m.ratingCount,
  });

  const today = matches.filter(m => m.date >= start && m.date <= end).map(slim);
  const upcoming = matches.filter(m => m.date > end).slice().reverse().map(slim);
  const past = matches.filter(m => m.date < start).map(slim);

  // 순위표 (리그별) + 구단색 오버라이드. 홈 노출 규칙(숨김 리그·시즌)으로 필터.
  const kstMonth = kstNow.getUTCMonth() + 1; // 1~12 (KST 기준)
  const standingRows = await prisma.standing.findMany({ orderBy: [{ league: "asc" }, { rank: "asc" }] });
  const standings: Record<string, any[]> = {};
  let standingsAsOf: Record<string, string> = {};
  for (const r of standingRows) {
    if (!standingsVisibleOnHome(r.league, kstMonth)) continue;
    (standings[r.league] ||= []).push({
      rank: r.rank, team: r.team, played: r.played, win: r.win, draw: r.draw,
      loss: r.loss, points: r.points, note: r.note,
    });
    standingsAsOf[r.league] = r.asOf.toISOString();
  }
  const colorRows = await prisma.teamColor.findMany();
  const teamColors: Record<string, string> = {};
  for (const c of colorRows) teamColors[c.team] = c.color;

  return (
    <div>
      {/* 오늘의 경기 — 모든 종목 */}
      <Section title="🔥 오늘의 경기" matches={today} empty="오늘 등록된 경기가 없습니다." />

      {/* 종목별 탭 — 순위표 + 예정·이전 경기 */}
      <SportTabs upcoming={upcoming} past={past}
        standings={standings} standingsAsOf={standingsAsOf} teamColors={teamColors} />
    </div>
  );
}
