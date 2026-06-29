import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import MatchClient from "./MatchClient";
import { teamLabel } from "@/app/MatchCard";
import { buildShareCardData } from "@/lib/shareCard";

const SPORT_LABEL: Record<string, string> = { kbo: "야구", kleague: "축구", lck: "LCK", epl: "EPL" };

export async function generateMetadata({ params }: any) {
  const m = await prisma.match.findUnique({ where: { id: params.matchId } });
  if (!m) return { title: "경기를 찾을 수 없습니다 · fanarena.kr" };
  const label = SPORT_LABEL[m.sport] ?? "";
  const home = teamLabel(m.sport, m.homeTeam), away = teamLabel(m.sport, m.awayTeam);
  const score = `${home} ${m.homeScore ?? "-"} : ${m.awayScore ?? "-"} ${away}`;
  const title = `${score} 팬 평점 · fanarena.kr`;
  const description = `${label} ${home} vs ${away} 경기의 선수 평점을 매기고 의견을 나눠보세요.`;
  // 경기별 동적 카드 이미지 (가로). 링크 공유 시 X·카톡 썸네일로 노출.
  const image = `https://fanarena.kr/api/share-card/${m.id}`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      url: `https://fanarena.kr/${m.sport}/${m.id}`,
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function MatchPage({ params }: any) {
  const m = await prisma.match.findUnique({
    where: { id: params.matchId },
    include: { players: { include: { player: true } }, ratings: true, substitutions: true },
  });
  if (!m) notFound();

  const aggBySeg: Record<string, Record<string, { sum: number; count: number }>> = {};
  for (const r of m.ratings) {
    aggBySeg[r.segment] ||= {};
    aggBySeg[r.segment][r.playerId] ||= { sum: 0, count: 0 };
    aggBySeg[r.segment][r.playerId].sum += r.score;
    aggBySeg[r.segment][r.playerId].count++;
  }

  const players = m.players.map(mp => ({
    mpId: mp.id, playerId: mp.playerId,
    name: mp.player.name, team: mp.player.team,
    role: mp.role != null ? mp.role : (mp.player.position || ""),
    isDefault: mp.isDefault,
    segment: mp.segment || "all",
    posX: mp.posX ?? null,
    posY: mp.posY ?? null,
    avg: null as number | null,
    count: 0,
    champions: (mp.champions as Record<string, string> | null) ?? undefined,
    battingOrder: mp.battingOrder ?? null,
    isPitcher: mp.player.isPitcher ?? null,
  }));

  const aggClean: Record<string, Record<string, { avg: number; count: number }>> = {};
  for (const seg of Object.keys(aggBySeg)) {
    aggClean[seg] = {};
    for (const pid of Object.keys(aggBySeg[seg])) {
      const a = aggBySeg[seg][pid];
      aggClean[seg][pid] = { avg: Number((a.sum / a.count).toFixed(2)), count: a.count };
    }
  }

  // 구단 색상 오버라이드 (해당 두 팀만)
  const colorRows = await prisma.teamColor.findMany({ where: { team: { in: [m.homeTeam, m.awayTeam] } } });
  const teamColors: Record<string, string> = {};
  for (const c of colorRows) teamColors[c.team] = c.color;

  // 공유 카드 데이터 (평점 30개 이상·종료 시 노출). 이미 가진 쿼리로 계산.
  const shareCard = buildShareCardData(
    {
      id: m.id, sport: m.sport, homeTeam: m.homeTeam, awayTeam: m.awayTeam,
      homeLabel: teamLabel(m.sport, m.homeTeam), awayLabel: teamLabel(m.sport, m.awayTeam),
      homeScore: m.homeScore, awayScore: m.awayScore, date: m.date, round: m.round ?? null, status: m.status,
    },
    m.players.map(mp => ({
      playerId: mp.playerId, name: mp.player.name, team: mp.player.team,
      role: (mp.role ?? mp.player.position ?? "") || "", isPitcher: mp.player.isPitcher ?? null,
    })),
    m.ratings.map(r => ({ playerId: r.playerId, score: r.score })),
  );

  return (
    <MatchClient
      teamColors={teamColors}
      shareCard={shareCard}
      match={{ id: m.id, sport: m.sport, homeTeam: m.homeTeam, awayTeam: m.awayTeam,
        homeScore: m.homeScore, awayScore: m.awayScore, date: m.date.toISOString(),
        round: m.round ?? null,
        record: m.record ?? null, status: m.status, seed: m.seed ?? null,
        setResults: (m.setResults as Record<string, string> | null) ?? null }}
      players={players}
      agg={aggClean}
      subs={m.substitutions.map(s => ({ minute: s.minute, outPlayerId: s.outPlayerId, inPlayerId: s.inPlayerId, kind: s.kind ?? null }))}
    />
  );
}
