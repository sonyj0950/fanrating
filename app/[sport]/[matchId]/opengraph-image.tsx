import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "fanarena.kr 경기 평점";

const SPORT_EMOJI: Record<string, string> = { kbo: "⚾", kleague: "⚽", lck: "🎮" };

export default async function Image({ params }: { params: { sport: string; matchId: string } }) {
  const m = await prisma.match.findUnique({
    where: { id: params.matchId },
    include: { players: { include: { player: true } }, ratings: true },
  });

  // 경기 없을 때 기본 카드
  if (!m) {
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a", color: "#fff", fontSize: 64, fontWeight: 700 }}>
          🏟️ fanarena.kr
        </div>
      ), size);
  }

  // POG 계산 (전체 평점 평균 최고)
  const agg: Record<string, { sum: number; n: number }> = {};
  for (const r of m.ratings) {
    agg[r.playerId] ||= { sum: 0, n: 0 };
    agg[r.playerId].sum += r.score;
    agg[r.playerId].n++;
  }
  let pog: { name: string; team: string; avg: number } | null = null;
  for (const mp of m.players) {
    const a = agg[mp.playerId];
    if (!a) continue;
    const avg = a.sum / a.n;
    if (!pog || avg > pog.avg) pog = { name: mp.player.name, team: mp.player.team, avg: Number(avg.toFixed(1)) };
  }
  const totalRatings = m.ratings.length;
  const emoji = SPORT_EMOJI[m.sport] ?? "🏟️";

  return new ImageResponse(
    (
      <div style={{
        width: "100%", height: "100%", display: "flex", flexDirection: "column",
        background: "linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)",
        color: "#fff", padding: 64, justifyContent: "space-between",
        fontFamily: "sans-serif",
      }}>
        <div style={{ display: "flex", alignItems: "center", fontSize: 36, opacity: 0.85 }}>
          🏟️ fanarena.kr
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 32, opacity: 0.7 }}>{emoji} 팬 평점</div>
          <div style={{ display: "flex", alignItems: "center", fontSize: 76, fontWeight: 800 }}>
            {m.homeTeam}
            <span style={{ margin: "0 28px", color: "#60a5fa" }}>
              {m.homeScore ?? "-"} : {m.awayScore ?? "-"}
            </span>
            {m.awayTeam}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {pog ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 30, color: "#fbbf24" }}>🏆 오늘의 선수</span>
                <span style={{ fontSize: 52, fontWeight: 800 }}>{pog.name} ⭐ {pog.avg}</span>
              </div>
            ) : (
              <span style={{ fontSize: 40, opacity: 0.8 }}>지금 평점을 매겨보세요</span>
            )}
          </div>
          <div style={{ fontSize: 28, opacity: 0.7, display: "flex" }}>
            {totalRatings > 0 ? `${totalRatings}개의 평점` : ""}
          </div>
        </div>
      </div>
    ),
    size
  );
}
