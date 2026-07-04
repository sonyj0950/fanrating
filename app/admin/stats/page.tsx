import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { sportPath } from "@/lib/sportUrl";

export const dynamic = "force-dynamic";
export const metadata = { title: "통계 대시보드 · fanarena.kr" };

const SPORT_LABEL: Record<string, string> = { kbo: "⚾ KBO", kleague: "⚽ K리그", lck: "🎮 LCK", epl: "⚽ EPL" };

export default async function AdminStatsPage() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") redirect("/");

  const now = Date.now();
  const days7 = new Date(now - 7 * 86_400_000);
  const days30 = new Date(now - 30 * 86_400_000);

  const [
    userTotal, userVerified, userNew7, userNew30,
    ratingTotal, rating7, ratingBlinded, ratingAvg, reportedRatings,
    discTotal, discBlinded,
    matchTotal, matchByStatus, matchBySport,
    topMatchesRaw, topRatersRaw,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { emailVerified: { not: null } } }),
    prisma.user.count({ where: { createdAt: { gte: days7 } } }),
    prisma.user.count({ where: { createdAt: { gte: days30 } } }),
    prisma.rating.count(),
    prisma.rating.count({ where: { createdAt: { gte: days7 } } }),
    prisma.rating.count({ where: { blinded: true } }),
    prisma.rating.aggregate({ _avg: { score: true } }),
    prisma.rating.count({ where: { reports: { some: {} } } }),
    prisma.discussionComment.count(),
    prisma.discussionComment.count({ where: { blinded: true } }),
    prisma.match.count(),
    prisma.match.groupBy({ by: ["status"], _count: { status: true } }),
    prisma.match.groupBy({ by: ["sport"], _count: { sport: true } }),
    prisma.rating.groupBy({ by: ["matchId"], _count: { matchId: true }, orderBy: { _count: { matchId: "desc" } }, take: 5 }),
    prisma.rating.groupBy({ by: ["userId"], _count: { userId: true }, orderBy: { _count: { userId: "desc" } }, take: 5 }),
  ]);

  // 상위 경기·유저의 라벨 채우기
  const matchMap = new Map(
    (await prisma.match.findMany({
      where: { id: { in: topMatchesRaw.map((m) => m.matchId) } },
      select: { id: true, sport: true, homeTeam: true, awayTeam: true },
    })).map((m) => [m.id, m])
  );
  const userMap = new Map(
    (await prisma.user.findMany({
      where: { id: { in: topRatersRaw.map((u) => u.userId) } },
      select: { id: true, nickname: true },
    })).map((u) => [u.id, u.nickname])
  );

  const statusCount = (s: string) => matchByStatus.find((m) => m.status === s)?._count.status ?? 0;
  const avgScore = ratingAvg._avg.score;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold mb-1">📊 통계 대시보드</h1>
        <p className="text-sm text-wfaint">사이트 참여 현황 한눈에 보기</p>
      </div>

      {/* 회원 */}
      <Section title="회원">
        <Stat label="전체 회원" value={userTotal} />
        <Stat label="이메일 인증" value={userVerified} sub={userTotal ? `${Math.round((userVerified / userTotal) * 100)}%` : ""} />
        <Stat label="최근 7일 가입" value={userNew7} accent />
        <Stat label="최근 30일 가입" value={userNew30} />
      </Section>

      {/* 평점 */}
      <Section title="평점">
        <Stat label="누적 평점" value={ratingTotal} />
        <Stat label="최근 7일" value={rating7} accent />
        <Stat label="평균 점수" value={avgScore != null ? avgScore.toFixed(2) : "—"} />
        <Stat label="블라인드" value={ratingBlinded} danger={ratingBlinded > 0} />
      </Section>

      {/* 커뮤니티 / 모더레이션 */}
      <Section title="토론 · 신고">
        <Stat label="토론 댓글" value={discTotal} />
        <Stat label="토론 블라인드" value={discBlinded} danger={discBlinded > 0} />
        <Stat label="신고된 평점" value={reportedRatings} danger={reportedRatings > 0} />
      </Section>

      {/* 경기 */}
      <Section title="경기">
        <Stat label="전체 경기" value={matchTotal} />
        <Stat label="예정" value={statusCount("scheduled")} />
        <Stat label="진행중" value={statusCount("live")} />
        <Stat label="종료" value={statusCount("finished")} />
      </Section>

      {matchBySport.length > 0 && (
        <div className="text-xs text-wfaint">
          종목별 경기: {matchBySport.map((m) => `${SPORT_LABEL[m.sport] || m.sport} ${m._count.sport}`).join(" · ")}
        </div>
      )}

      {/* 인기 경기 */}
      <div className="bg-card border rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-2">🔥 평점 많은 경기 TOP 5</h2>
        {topMatchesRaw.length === 0 ? (
          <p className="text-sm text-wfaint">데이터 없음</p>
        ) : (
          <ol className="space-y-1">
            {topMatchesRaw.map((m, i) => {
              const info = matchMap.get(m.matchId);
              return (
                <li key={m.matchId} className="flex items-center gap-2 text-sm">
                  <span className="text-wfaint w-4">{i + 1}</span>
                  {info ? (
                    <Link href={`/${sportPath(info.sport)}/${info.id}`} className="flex-1 min-w-0 truncate text-golddim hover:underline">
                      {SPORT_LABEL[info.sport] || info.sport} {info.homeTeam} vs {info.awayTeam}
                    </Link>
                  ) : (
                    <span className="flex-1 text-wfaint">(삭제된 경기)</span>
                  )}
                  <span className="text-xs font-semibold text-wsub shrink-0">{m._count.matchId}개</span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* 활발한 유저 */}
      <div className="bg-card border rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-2">🏅 평점 많이 남긴 유저 TOP 5</h2>
        {topRatersRaw.length === 0 ? (
          <p className="text-sm text-wfaint">데이터 없음</p>
        ) : (
          <ol className="space-y-1">
            {topRatersRaw.map((u, i) => (
              <li key={u.userId} className="flex items-center gap-2 text-sm">
                <span className="text-wfaint w-4">{i + 1}</span>
                <span className="flex-1 min-w-0 truncate">{userMap.get(u.userId) || "(탈퇴)"}</span>
                <span className="text-xs font-semibold text-wsub shrink-0">{u._count.userId}개</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-wsub mb-2">{title}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{children}</div>
    </div>
  );
}

function Stat({ label, value, sub, accent, danger }: { label: string; value: number | string; sub?: string; accent?: boolean; danger?: boolean }) {
  return (
    <div className={`border rounded-lg p-3 ${danger ? "bg-[#241310] border-[#5c2a2a]" : accent ? "bg-goldbg border-goldline" : "bg-card border-wline"}`}>
      <div className="text-xs text-wfaint">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${danger ? "text-live" : accent ? "text-golddim" : "text-ink"}`}>{value}</div>
      {sub && <div className="text-xs text-wfaint">{sub}</div>}
    </div>
  );
}
