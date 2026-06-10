import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";

const SEG_LABEL: Record<string, string> = {
  full: "총평", first: "전반", second: "후반",
  set1: "1세트", set2: "2세트", set3: "3세트", set4: "4세트", set5: "5세트",
};

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
    prisma.match.findUnique({ where: { id: params.matchId } }),
    prisma.user.findUnique({ where: { id: params.userId }, select: { nickname: true } }),
    prisma.rating.findMany({
      where: { matchId: params.matchId, userId: params.userId },
      include: { player: { select: { name: true, team: true } } },
      orderBy: { score: "desc" },
    }),
  ]);
  if (!m || !user) notFound();

  const avg = ratings.length ? (ratings.reduce((a, r) => a + r.score, 0) / ratings.length).toFixed(2) : "-";

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white border rounded-xl p-5">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-lg font-bold">{user.nickname}님의 평점</h1>
          <span className="text-blue-700 font-bold">⭐ {avg}</span>
        </div>
        <p className="text-sm text-gray-500 mb-4">{m.homeTeam} {m.homeScore ?? "-"} : {m.awayScore ?? "-"} {m.awayTeam}</p>

        {ratings.length === 0 ? (
          <p className="text-sm text-gray-400">아직 매긴 평점이 없습니다.</p>
        ) : (
          <div className="space-y-1.5">
            {ratings.map((r, i) => (
              <div key={i} className="flex items-center gap-2 border rounded-lg px-3 py-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${r.player.team === m.homeTeam ? "bg-blue-500" : "bg-red-500"}`} />
                <span className="text-sm font-medium flex-1 truncate">
                  {r.player.name}
                  {r.segment !== "full" && SEG_LABEL[r.segment] && <span className="text-xs text-gray-400 ml-1">{SEG_LABEL[r.segment]}</span>}
                </span>
                <span className="text-sm font-bold text-blue-700">⭐ {r.score}</span>
              </div>
            ))}
          </div>
        )}

        <Link href={`/${m.sport}/${m.id}`}
          className="block text-center mt-4 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-semibold">
          이 경기에서 나도 평점 매기기 →
        </Link>
      </div>
    </div>
  );
}
