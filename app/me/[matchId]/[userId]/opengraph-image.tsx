import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "fanarena.kr 나의 평점";

const SEG_LABEL: Record<string, string> = {
  full: "", first: "전반", second: "후반",
  set1: "1세트", set2: "2세트", set3: "3세트", set4: "4세트", set5: "5세트",
};

function Mark() {
  return (
    <svg width="84" height="84" viewBox="0 0 120 120">
      <ellipse cx="60" cy="60" rx="58" ry="58" fill="#0a0a0a" />
      <ellipse cx="60" cy="64" rx="40" ry="34" fill="#ffffff" />
      <rect x="58.5" y="32" width="3" height="64" fill="#1a1a1a" />
      <circle cx="60" cy="64" r="11" fill="none" stroke="#1a1a1a" strokeWidth="3" />
      <path d="M30 18 L42 40 L24 40 Z" fill="#0a0a0a" />
      <path d="M90 18 L96 40 L78 40 Z" fill="#0a0a0a" />
      <path d="M60 57 l2.3 4.7 5.2 .7 -3.8 3.7 .9 5.2 -4.6 -2.5 -4.6 2.5 .9 -5.2 -3.8 -3.7 5.2 -.7 Z" fill="#0a0a0a" />
    </svg>
  );
}

export default async function Image({ params }: { params: { matchId: string; userId: string } }) {
  const [m, user, ratings] = await Promise.all([
    prisma.match.findUnique({ where: { id: params.matchId } }),
    prisma.user.findUnique({ where: { id: params.userId }, select: { nickname: true } }),
    prisma.rating.findMany({
      where: { matchId: params.matchId, userId: params.userId },
      include: { player: { select: { name: true, team: true } } },
      orderBy: { score: "desc" },
    }),
  ]);

  if (!m || !user) {
    return new ImageResponse(
      (<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", color: "#0a0a0a", fontSize: 64, fontWeight: 800 }}>fanarena.kr</div>),
      size);
  }

  const avg = ratings.length ? (ratings.reduce((a, r) => a + r.score, 0) / ratings.length).toFixed(1) : "-";

  // 내 최고 평점 선수 (동점이면 총평 총점이 높은 선수)
  const myBest: Record<string, number> = {};
  for (const r of ratings) {
    if (myBest[r.playerId] === undefined || r.score > myBest[r.playerId]) myBest[r.playerId] = r.score;
  }
  const ids = Object.keys(myBest);
  let topName = "";
  let topScore = 0;
  if (ids.length > 0) {
    const max = Math.max(...ids.map(id => myBest[id]));
    const tied = ids.filter(id => myBest[id] === max);
    let bestId = tied[0];
    if (tied.length > 1) {
      const all = await prisma.rating.findMany({ where: { matchId: params.matchId, playerId: { in: tied } }, select: { playerId: true, score: true } });
      const s: Record<string, number> = {};
      for (const r of all) s[r.playerId] = (s[r.playerId] || 0) + r.score;
      for (const id of tied) if ((s[id] || 0) > (s[bestId] || 0)) bestId = id;
    }
    const r0 = ratings.find(r => r.playerId === bestId);
    topName = r0?.player.name ?? "";
    topScore = max;
  }
  const top = ratings.slice(0, 6);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#ffffff", fontFamily: "sans-serif", padding: 56 }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Mark />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 34, fontWeight: 800, color: "#0a0a0a" }}>{user.nickname}님의 평점</span>
              <span style={{ fontSize: 22, color: "#6b7280" }}>{m.homeTeam} {m.homeScore ?? "-"} : {m.awayScore ?? "-"} {m.awayTeam}</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <span style={{ fontSize: 18, color: "#9ca3af" }}>{topName ? "내 최고 평점" : "내 평균"}</span>
            <span style={{ fontSize: topName ? 40 : 56, fontWeight: 800, color: "#2563eb" }}>
              {topName ? `${topName} ⭐${topScore}` : `⭐ ${avg}`}
            </span>
          </div>
        </div>

        <div style={{ height: 2, background: "#eef1f5", margin: "28px 0" }} />

        {/* ratings list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
          {top.length === 0 ? (
            <span style={{ fontSize: 30, color: "#9ca3af" }}>아직 매긴 평점이 없습니다</span>
          ) : top.map((r, i) => {
            const isHome = r.player.team === m.homeTeam;
            const seg = SEG_LABEL[r.segment] ? ` · ${SEG_LABEL[r.segment]}` : "";
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 14, height: 14, borderRadius: 7, background: isHome ? "#3b82f6" : "#ef4444" }} />
                <span style={{ fontSize: 30, fontWeight: 600, color: "#111827", flex: 1 }}>{r.player.name}<span style={{ fontSize: 20, color: "#9ca3af" }}>{seg}</span></span>
                <div style={{ display: "flex", width: 320, height: 26, background: "#eef1f5", borderRadius: 6 }}>
                  <div style={{ width: `${((r.score - 1) / 8) * 100}%`, background: isHome ? "#3b82f6" : "#ef4444", borderRadius: 6 }} />
                </div>
                <span style={{ fontSize: 28, fontWeight: 800, color: "#0a0a0a", width: 44, textAlign: "right" }}>{r.score}</span>
              </div>
            );
          })}
        </div>

        {/* footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
          <span style={{ fontSize: 24, fontWeight: 700, color: "#0a0a0a" }}>fanarena<span style={{ color: "#9ca3af" }}>.</span>kr</span>
          <span style={{ fontSize: 20, color: "#9ca3af" }}>{ratings.length > top.length ? `외 ${ratings.length - top.length}명 더` : "팬이 평가하고, 경기가 더 재밌어진다"}</span>
        </div>
      </div>
    ),
    size
  );
}
