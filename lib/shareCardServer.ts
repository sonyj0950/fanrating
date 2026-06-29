/**
 * 서버에서 matchId로 공유 카드 데이터를 만든다 (이미지 라우트용).
 * 경기 페이지(page.tsx)는 이미 가진 쿼리로 buildShareCardData를 직접 호출하므로 이 함수를 쓰지 않는다.
 */
import { prisma } from "@/lib/prisma";
import { teamLabel } from "@/app/MatchCard";
import { buildShareCardData, type ShareCardData } from "./shareCard";

export async function getShareCardData(matchId: string): Promise<ShareCardData | null> {
  const m = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      players: { include: { player: true } },
      ratings: { select: { playerId: true, score: true } },
    },
  });
  if (!m) return null;

  const players = m.players.map((mp) => ({
    playerId: mp.playerId,
    name: mp.player.name,
    team: mp.player.team,
    role: (mp.role ?? mp.player.position ?? "") || "",
    isPitcher: mp.player.isPitcher ?? null,
  }));

  return buildShareCardData(
    {
      id: m.id,
      sport: m.sport,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      homeLabel: teamLabel(m.sport, m.homeTeam),
      awayLabel: teamLabel(m.sport, m.awayTeam),
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      date: m.date,
      round: m.round ?? null,
      status: m.status,
    },
    players,
    m.ratings,
  );
}
