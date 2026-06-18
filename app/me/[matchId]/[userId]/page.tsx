import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import SharePitch from "./SharePitch";

export async function generateMetadata({ params }: any) {
  const [m, user] = await Promise.all([
    prisma.match.findUnique({ where: { id: params.matchId } }),
    prisma.user.findUnique({ where: { id: params.userId }, select: { nickname: true } }),
  ]);
  if (!m || !user) return { title: "fanarena.kr" };
  const title = `${user.nickname}님의 평점 · ${m.homeTeam} ${m.homeScore ?? "-"}:${m.awayScore ?? "-"} ${m.awayTeam}`;
  const description = `${user.nickname}님이 매긴 선수 평점을 확인해보세요 · fanarena.kr`;
  return {
    title, description,
    openGraph: { title, description, type: "article" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function SharePage({ params }: any) {
  const [m, user, ratings] = await Promise.all([
    prisma.match.findUnique({
      where: { id: params.matchId },
      include: { players: { include: { player: true } }, substitutions: true },
    }),
    prisma.user.findUnique({ where: { id: params.userId }, select: { nickname: true } }),
    prisma.rating.findMany({
      where: { matchId: params.matchId, userId: params.userId },
    }),
  ]);
  if (!m || !user) notFound();

  // 내 점수 맵 (총평 우선, 없으면 가장 먼저 나온 구간)
  const myScore: Record<string, number> = {};
  for (const r of ratings) {
    if (r.segment === "full" || myScore[r.playerId] === undefined) myScore[r.playerId] = r.score;
  }
  const avg = ratings.length ? (ratings.reduce((a, r) => a + r.score, 0) / ratings.length).toFixed(2) : "-";

  // 내가 가장 높은 점수를 준 선수 (동점이면 총평 총점이 높은 선수)
  const myBest: Record<string, number> = {};
  for (const r of ratings) {
    if (myBest[r.playerId] === undefined || r.score > myBest[r.playerId]) myBest[r.playerId] = r.score;
  }
  const ids = Object.keys(myBest);
  let topName: string | null = null;
  let topScore = 0;
  if (ids.length > 0) {
    const max = Math.max(...ids.map(id => myBest[id]));
    const tied = ids.filter(id => myBest[id] === max);
    let bestId = tied[0];
    if (tied.length > 1) {
      const all = await prisma.rating.findMany({ where: { matchId: params.matchId, playerId: { in: tied } }, select: { playerId: true, score: true } });
      const sum: Record<string, number> = {};
      for (const r of all) sum[r.playerId] = (sum[r.playerId] || 0) + r.score;
      for (const id of tied) if ((sum[id] || 0) > (sum[bestId] || 0)) bestId = id;
    }
    const mp = m.players.find(p => p.playerId === bestId);
    topName = mp?.player.name ?? null;
    topScore = max;
  }

  // 필드용 player 목록 (avg = 내 점수)
  const players = m.players.map(mp => ({
    mpId: mp.id,
    playerId: mp.playerId,
    name: mp.player.name,
    team: mp.player.team,
    role: mp.role || mp.player.position || "",
    isDefault: mp.isDefault,
    segment: mp.segment || "all",
    posX: mp.posX ?? null,
    posY: mp.posY ?? null,
    avg: myScore[mp.playerId] ?? null,
    count: myScore[mp.playerId] !== undefined ? 1 : 0,
  }));

  return (
    <div className="max-w-md mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-bold">{user.nickname}님의 평점</h1>
        {topName
          ? <span className="text-blue-700 font-bold text-sm">최고 ⭐ {topName} {topScore}</span>
          : <span className="text-blue-700 font-bold">⭐ {avg}</span>}
      </div>
      <p className="text-sm text-gray-500 mb-4">
        {m.homeTeam} {m.homeScore ?? "-"} : {m.awayScore ?? "-"} {m.awayTeam}
      </p>

      {ratings.length === 0 ? (
        <p className="text-sm text-gray-400 bg-white border rounded-lg p-4">아직 매긴 평점이 없습니다.</p>
      ) : (
        <SharePitch sport={m.sport} players={players} homeTeam={m.homeTeam} awayTeam={m.awayTeam}
          subs={m.substitutions.map(s => ({ minute: s.minute, outPlayerId: s.outPlayerId, inPlayerId: s.inPlayerId }))} />
      )}

      <Link href={`/${m.sport}/${m.id}`}
        className="block text-center mt-5 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-semibold">
        이 경기에서 나도 평점 매기기 →
      </Link>
    </div>
  );
}
