import Link from "next/link";
import { prisma } from "@/lib/prisma";
import DeleteMatchButton from "@/components/DeleteMatchButton";

export const dynamic = "force-dynamic";

const SPORT_LABEL: Record<string, string> = {
  kbo: "⚾ 야구", kleague: "⚽ 축구", lck: "🎮 LCK",
};
const STATUS_LABEL: Record<string, string> = {
  scheduled: "예정", live: "진행중", finished: "종료",
};

function MatchCard({ m }: { m: any }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border p-3 flex items-center gap-2">
      <Link href={`/${m.sport}/${m.id}`} className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
          <span>{SPORT_LABEL[m.sport] ?? m.sport}</span>
          <span className={m.status === "live" ? "text-red-500 font-semibold" : ""}>
            {STATUS_LABEL[m.status] ?? m.status}
          </span>
          <span>{new Date(m.date).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        <div className="font-semibold truncate">
          {m.homeTeam} <span className="text-blue-600">{m.homeScore ?? "-"}</span>
          {" : "}
          <span className="text-blue-600">{m.awayScore ?? "-"}</span> {m.awayTeam}
        </div>
        {m.pog && (
          <div className="text-xs text-gray-500 mt-0.5 truncate">
            🏆 {m.pog.name} ⭐ {m.pog.avg}
            {m.ratingCount ? <span className="text-gray-400"> · 평점 {m.ratingCount}</span> : null}
          </div>
        )}
      </Link>
      <DeleteMatchButton matchId={m.id} />
    </div>
  );
}

function Section({ title, matches, empty }: { title: string; matches: any[]; empty: string }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold mb-3">{title}</h2>
      {matches.length === 0
        ? <p className="text-sm text-gray-400 bg-white border rounded-lg p-4">{empty}</p>
        : <div className="space-y-2">{matches.map(m => <MatchCard key={m.id} m={m} />)}</div>}
    </section>
  );
}

export default async function Home() {
  const raw = await prisma.match.findMany({
    orderBy: { date: "desc" },
    include: { players: { include: { player: true } }, ratings: true },
  });

  // 경기별 POG(평점 최고 선수) 계산
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

  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(); end.setHours(23, 59, 59, 999);

  const today = matches.filter(m => m.date >= start && m.date <= end);
  const upcoming = matches.filter(m => m.date > end).slice().reverse();
  const past = matches.filter(m => m.date < start);

  return (
    <div>
      <Section title="🔥 오늘의 경기" matches={today} empty="오늘 등록된 경기가 없습니다." />
      {upcoming.length > 0 && <Section title="📅 예정된 경기" matches={upcoming} empty="" />}
      <Section title="🗂 이전의 경기" matches={past} empty="이전 경기가 없습니다." />
    </div>
  );
}
