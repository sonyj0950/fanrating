import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isNationalTeamMatch, seasonStarts, seasonLabels } from "@/lib/rankings";
import { badgeLabel, badgeTextColor, teamColor } from "@/lib/teamColors";
import { GoldStar, SPORT_LABEL, StatusBadge, teamLabel } from "@/app/MatchCard";
import { scoreTextColor } from "@/lib/scoreColor";
import { sportPath } from "@/lib/sportUrl";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { playerId: string } }): Promise<Metadata> {
  const player = await prisma.player.findUnique({ where: { id: params.playerId }, select: { name: true } });
  if (!player) return { title: "선수 평점" };
  return {
    title: `${player.name} 선수 평점`,
    description: `${player.name} 선수의 팬 평점 — 시즌 평균, 경기별 평점 트렌드, 팬 코멘트를 한눈에.`,
  };
}

type MatchPoint = {
  matchId: string;
  sport: string;
  date: Date;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  round: string | null;
  avg: number;
  count: number;
};

// 경기별 평균 평점 꺾은선 (서버 렌더 SVG — 시간순, 마지막 점 강조)
function TrendChart({ points }: { points: MatchPoint[] }) {
  const W = 640, H = 190, PAD_L = 30, PAD_R = 16, PAD_T = 18, PAD_B = 30;
  const lo = Math.max(0, Math.floor(Math.min(...points.map(p => p.avg)) - 0.5));
  const hi = Math.min(10, Math.ceil(Math.max(...points.map(p => p.avg)) + 0.5));
  const x = (i: number) =>
    points.length === 1 ? W / 2 : PAD_L + (i / (points.length - 1)) * (W - PAD_L - PAD_R);
  const y = (v: number) => PAD_T + (1 - (v - lo) / (hi - lo)) * (H - PAD_T - PAD_B);
  const grid: number[] = [];
  for (let v = lo; v <= hi; v++) grid.push(v);
  const fmt = (d: Date) =>
    d.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric" });
  // x축 라벨: 겹치지 않게 최대 6개만
  const step = Math.max(1, Math.ceil(points.length / 6));
  const showAvgLabel = points.length <= 12;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img"
      aria-label={`경기별 평균 평점 추이 (${points.length}경기)`}>
      {grid.map(v => (
        <g key={v}>
          <line x1={PAD_L} y1={y(v)} x2={W - PAD_R} y2={y(v)} stroke="#f0ede2" strokeWidth="1" />
          <text x={PAD_L - 6} y={y(v) + 3.5} textAnchor="end" fontSize="10" fill="#a49d8b">{v}</text>
        </g>
      ))}
      {points.length > 1 && (
        <polyline fill="none" stroke="#f5b301" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
          points={points.map((p, i) => `${x(i)},${y(p.avg)}`).join(" ")} />
      )}
      {points.map((p, i) => (
        <g key={p.matchId}>
          <circle cx={x(i)} cy={y(p.avg)} r={i === points.length - 1 ? 5 : 3.5}
            fill={i === points.length - 1 ? "#f5b301" : "#fffdf8"} stroke="#f5b301" strokeWidth="2" />
          {showAvgLabel && (
            <text x={x(i)} y={y(p.avg) - 9} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#1a1a1a">
              {p.avg.toFixed(1)}
            </text>
          )}
          {(i % step === 0 || i === points.length - 1) && (
            <text x={x(i)} y={H - 10} textAnchor="middle" fontSize="10" fill="#8d8672">{fmt(p.date)}</text>
          )}
        </g>
      ))}
    </svg>
  );
}

function Metric({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl border border-wline bg-card px-3 py-2.5 text-center">
      <div className="text-[11px] text-wsub font-semibold mb-0.5">{label}</div>
      <div className="text-lg font-black text-ink tabular-nums leading-tight">{value}</div>
      {sub && <div className="text-[10px] text-wfaint mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

export default async function PlayerPage({ params }: { params: { playerId: string } }) {
  const player = await prisma.player.findUnique({ where: { id: params.playerId } });
  if (!player) notFound();

  const [ratings, colorRows] = await Promise.all([
    prisma.rating.findMany({
      where: { playerId: player.id },
      select: {
        score: true, comment: true, blinded: true,
        user: { select: { nickname: true } },
        _count: { select: { likes: true } },
        match: {
          select: {
            id: true, sport: true, date: true, homeTeam: true, awayTeam: true,
            homeScore: true, awayScore: true, round: true,
          },
        },
      },
    }),
    prisma.teamColor.findMany(),
  ]);
  const overrides: Record<string, string> = {};
  for (const c of colorRows) overrides[c.team] = c.color;

  // 종목은 가장 최근 경기 기준, 통계는 현재 시즌 윈도우만
  const latest = ratings.reduce<Date | null>((t, r) => (!t || r.match.date > t ? r.match.date : t), null);
  const sport = ratings.find(r => r.match.date.getTime() === latest?.getTime())?.match.sport ?? "kleague";
  const start = seasonStarts()[sport];
  const season = ratings.filter(
    r => r.match.date >= start && r.match.sport === sport && !isNationalTeamMatch(r.match),
  );

  // 경기별 집계 (시간순)
  const byMatch = new Map<string, { m: (typeof season)[number]["match"]; sum: number; n: number }>();
  for (const r of season) {
    const a = byMatch.get(r.match.id);
    if (a) { a.sum += r.score; a.n++; }
    else byMatch.set(r.match.id, { m: r.match, sum: r.score, n: 1 });
  }
  const points: MatchPoint[] = Array.from(byMatch.values())
    .map(({ m, sum, n }) => ({
      matchId: m.id, sport: m.sport, date: m.date, homeTeam: m.homeTeam, awayTeam: m.awayTeam,
      homeScore: m.homeScore, awayScore: m.awayScore, round: m.round,
      avg: Number((sum / n).toFixed(2)), count: n,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const total = season.length;
  const avg = total ? Number((season.reduce((s, r) => s + r.score, 0) / total).toFixed(2)) : null;
  const best = points.length ? points.reduce((a, b) => (b.avg > a.avg ? b : a)) : null;
  const worst = points.length ? points.reduce((a, b) => (b.avg < a.avg ? b : a)) : null;

  // 베스트 코멘트 — 좋아요순 상위 3 (블라인드 제외)
  const bestComments = season
    .filter(r => r.comment.trim() !== "" && !r.blinded)
    .sort((a, b) => b._count.likes - a._count.likes)
    .slice(0, 3);

  const bg = teamColor(player.team, overrides, "#7d7663");
  const opponentOf = (p: MatchPoint) =>
    p.homeTeam === player.team ? p.awayTeam : p.awayTeam === player.team ? p.homeTeam : null;

  return (
    <div>
      {/* 프로필 헤더 */}
      <div className="flex items-center gap-3.5 rounded-2xl border border-wline bg-card p-4 shadow-[0_1px_2px_rgba(60,50,20,.05)] mb-4">
        <span aria-hidden="true"
          className="w-14 h-14 rounded-full grid place-items-center font-black leading-none whitespace-nowrap select-none shrink-0"
          style={{ background: bg, color: badgeTextColor(bg),
            fontSize: badgeLabel(player.team).length >= 3 ? 15 : 20, letterSpacing: "-0.02em" }}>
          {badgeLabel(player.team)}
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold text-ink truncate">{player.name}</h1>
          <p className="text-[13px] text-wsub font-semibold truncate">
            {teamLabel(sport, player.team)}{player.position ? ` · ${player.position}` : ""}
            <span className="text-wfaint font-medium"> · {SPORT_LABEL[sport] ?? sport} · {seasonLabels()[sport]}</span>
          </p>
        </div>
        <Link href="/rankings" className="ml-auto shrink-0 text-xs font-semibold text-wsub border border-wline rounded-full px-3 py-1.5 hover:border-ink hover:text-ink transition">
          랭킹
        </Link>
      </div>

      {total === 0 ? (
        <p className="text-sm text-wfaint bg-card border border-dashed border-wline rounded-xl p-6 text-center">
          이번 시즌 평가 기록이 없습니다.
        </p>
      ) : (
        <>
          {/* 시즌 요약 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            <Metric label="시즌 평균"
              value={<span className="inline-flex items-center gap-1" style={{ color: scoreTextColor(avg!) }}><GoldStar className="w-3.5 h-3.5" />{avg!.toFixed(2)}</span>}
              sub={`평가 ${total.toLocaleString()}회`} />
            <Metric label="평가된 경기" value={points.length} sub="경기" />
            <Metric label="최고 평점" value={<span style={{ color: scoreTextColor(best!.avg) }}>{best!.avg.toFixed(2)}</span>}
              sub={opponentOf(best!) ? `vs ${teamLabel(sport, opponentOf(best!)!)}` : undefined} />
            <Metric label="최저 평점" value={<span style={{ color: scoreTextColor(worst!.avg) }}>{worst!.avg.toFixed(2)}</span>}
              sub={opponentOf(worst!) ? `vs ${teamLabel(sport, opponentOf(worst!)!)}` : undefined} />
          </div>

          {/* 평점 트렌드 */}
          <div className="rounded-2xl border border-wline bg-card p-3.5 shadow-[0_1px_2px_rgba(60,50,20,.05)] mb-4">
            <h2 className="text-[13px] font-extrabold text-ink px-1 mb-1.5">경기별 평점 추이</h2>
            <TrendChart points={points} />
          </div>

          {/* 경기별 기록 (최신순) */}
          <div className="rounded-2xl border border-wline bg-card overflow-hidden shadow-[0_1px_2px_rgba(60,50,20,.05)] mb-4">
            <h2 className="text-[13px] font-extrabold text-ink px-3.5 py-2.5 border-b border-wsoft">경기별 기록</h2>
            {points.slice().reverse().map(p => {
              const opp = opponentOf(p);
              return (
                <Link key={p.matchId} href={`/${sportPath(p.sport)}/${p.matchId}`}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 border-t border-dashed border-wsoft first-of-type:border-t-0 text-[13px] hover:bg-paper/60 transition">
                  <span className="w-14 shrink-0 text-[11px] text-wfaint tabular-nums">
                    {p.date.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric" })}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold text-ink truncate">
                      {opp ? `vs ${teamLabel(sport, opp)}` : `${teamLabel(sport, p.homeTeam)} vs ${teamLabel(sport, p.awayTeam)}`}
                      {p.homeScore != null && p.awayScore != null && (
                        <span className="text-wsub font-semibold tabular-nums"> · {p.homeScore}:{p.awayScore}</span>
                      )}
                    </span>
                    {p.round && <span className="block text-[11px] text-wsub truncate">{p.round}</span>}
                  </span>
                  <span className="text-[11px] text-wfaint tabular-nums shrink-0">평가 {p.count}</span>
                  <span className="w-12 text-right font-black text-[15px] tabular-nums text-ink shrink-0">{p.avg.toFixed(2)}</span>
                </Link>
              );
            })}
          </div>

          {/* 베스트 코멘트 */}
          {bestComments.length > 0 && (
            <div className="rounded-2xl border border-wline bg-card overflow-hidden shadow-[0_1px_2px_rgba(60,50,20,.05)]">
              <h2 className="text-[13px] font-extrabold text-ink px-3.5 py-2.5 border-b border-wsoft">베스트 코멘트</h2>
              {bestComments.map((r, i) => (
                <div key={i} className="px-3.5 py-2.5 border-t border-dashed border-wsoft first-of-type:border-t-0">
                  <div className="flex items-center gap-2 text-[11px] mb-1">
                    <span className="font-bold text-golddim tabular-nums">{r.score}점</span>
                    <span className="text-wsub font-semibold">{r.user.nickname}</span>
                    {r._count.likes > 0 && <span className="text-wfaint ml-auto">좋아요 {r._count.likes}</span>}
                  </div>
                  <p className="text-[13px] text-ink leading-relaxed break-words">{r.comment}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
