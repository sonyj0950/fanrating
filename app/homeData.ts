import { prisma } from "@/lib/prisma";
import { standingsVisibleOnHome } from "@/lib/standings";

// 홈(/)과 종목 페이지(/soccer·/baseball·/lol)가 공유하는 데이터 로더.
export async function getHomeData() {
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
    // 홈/원정 팬 평점 우세 (히어로 바) — 선수 소속으로 갈라 평균, 양쪽 다 평가가 있어야 유효
    let split: { home: number; away: number } | null = null;
    const side = { home: { sum: 0, n: 0 }, away: { sum: 0, n: 0 } };
    for (const mp of m.players) {
      const a = agg[mp.playerId];
      if (!a) continue;
      if (mp.player.team === m.homeTeam) { side.home.sum += a.sum; side.home.n += a.n; }
      else if (mp.player.team === m.awayTeam) { side.away.sum += a.sum; side.away.n += a.n; }
    }
    if (side.home.n >= 3 && side.away.n >= 3) {
      const h = side.home.sum / side.home.n, w = side.away.sum / side.away.n;
      split = { home: Number(h.toFixed(2)), away: Number(w.toFixed(2)) };
    }
    return { ...m, pog, split, ratingCount: m.ratings.length };
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
    split: m.split ?? null,
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

  // ── 사이드바 데이터 ──
  // 이번 주(최근 7일) 평점 TOP 5: 최근 7일간 등록된 평점을 선수별 집계 (5개 이상)
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const weekRatings = await prisma.rating.findMany({
    where: { createdAt: { gte: weekAgo } },
    select: { playerId: true, score: true, player: { select: { name: true, team: true } } },
  });
  const perPlayer = new Map<string, { name: string; team: string; sum: number; n: number }>();
  for (const r of weekRatings) {
    let a = perPlayer.get(r.playerId);
    if (!a) { a = { name: r.player.name, team: r.player.team, sum: 0, n: 0 }; perPlayer.set(r.playerId, a); }
    a.sum += r.score; a.n++;
  }
  const weekTop5 = Array.from(perPlayer.entries())
    .filter(([, a]) => a.n >= 5)
    .map(([playerId, a]) => ({ playerId, name: a.name, team: a.team, avg: Number((a.sum / a.n).toFixed(1)), count: a.n }))
    .sort((a, b) => b.avg - a.avg || b.count - a.count)
    .slice(0, 5);

  // 주간 베스트 경기: 최근 7일 경기 중 평점 참여수 상위 3
  const weekBest = matches
    .filter(m => m.date >= weekAgo && m.ratingCount > 0)
    .sort((a, b) => b.ratingCount - a.ratingCount)
    .slice(0, 3)
    .map(slim);

  return { today, upcoming, past, standings, standingsAsOf, teamColors, weekTop5, weekBest };
}
