import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import MatchClient from "./MatchClient";

const SPORT_LABEL: Record<string, string> = { kbo: "야구", kleague: "축구", lck: "LCK", epl: "EPL" };

export async function generateMetadata({ params }: any) {
  const m = await prisma.match.findUnique({ where: { id: params.matchId } });
  if (!m) return { title: "경기를 찾을 수 없습니다 · fanarena.kr" };
  const label = SPORT_LABEL[m.sport] ?? "";
  const score = `${m.homeTeam} ${m.homeScore ?? "-"} : ${m.awayScore ?? "-"} ${m.awayTeam}`;
  const title = `${score} 팬 평점 · fanarena.kr`;
  const description = `${label} ${m.homeTeam} vs ${m.awayTeam} 경기의 선수 평점을 매기고 의견을 나눠보세요.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "article", url: `https://fanarena.kr/${m.sport}/${m.id}` },
    twitter: { card: "summary_large_image", title, description },
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
  }));

  const aggClean: Record<string, Record<string, { avg: number; count: number }>> = {};
  for (const seg of Object.keys(aggBySeg)) {
    aggClean[seg] = {};
    for (const pid of Object.keys(aggBySeg[seg])) {
      const a = aggBySeg[seg][pid];
      aggClean[seg][pid] = { avg: Number((a.sum / a.count).toFixed(2)), count: a.count };
    }
  }

  return (
    <MatchClient
      match={{ id: m.id, sport: m.sport, homeTeam: m.homeTeam, awayTeam: m.awayTeam,
        homeScore: m.homeScore, awayScore: m.awayScore, date: m.date.toISOString(),
        record: m.record ?? null, status: m.status, seed: m.seed ?? null }}
      players={players}
      agg={aggClean}
      subs={m.substitutions.map(s => ({ minute: s.minute, outPlayerId: s.outPlayerId, inPlayerId: s.inPlayerId }))}
    />
  );
}
