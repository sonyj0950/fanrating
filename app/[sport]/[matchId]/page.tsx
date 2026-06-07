import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import MatchClient from "./MatchClient";

export default async function MatchPage({ params }: any) {
  const m = await prisma.match.findUnique({
    where: { id: params.matchId },
    include: { players: { include: { player: true } }, ratings: true },
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
    role: mp.role || mp.player.position || "",
    isDefault: mp.isDefault,
    segment: mp.segment || "all",
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
        record: m.record ?? null }}
      players={players}
      agg={aggClean}
    />
  );
}
