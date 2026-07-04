import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { sportPath } from "@/lib/sportUrl";

export const dynamic = "force-dynamic";

const SPORT_LABEL: Record<string, string> = { kbo: "⚾ KBO", kleague: "⚽ K리그", lck: "🎮 LCK", epl: "⚽ EPL" };

export async function generateMetadata({ params }: any) {
  const u = await prisma.user.findUnique({ where: { id: params.id }, select: { nickname: true } });
  return { title: u ? `${u.nickname} · fanarena.kr` : "프로필 · fanarena.kr" };
}

export default async function ProfilePage({ params }: any) {
  const id = params.id;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, nickname: true, createdAt: true, emailVerified: true, role: true, profilePublic: true },
  });
  if (!user) notFound();

  const session = await getServerSession(authOptions);
  const isOwner = (session?.user as any)?.id === id;
  const viewerIsAdmin = (session?.user as any)?.role === "admin";

  // 비공개 프로필: 본인·관리자만 열람. 그 외에는 최소 정보만 노출.
  if (!user.profilePublic && !isOwner && !viewerIsAdmin) {
    return (
      <div className="bg-card border rounded-xl p-8 text-center max-w-md mx-auto mt-6">
        <div className="w-14 h-14 rounded-full bg-wgray text-wfaint flex items-center justify-center text-2xl mx-auto mb-3">🔒</div>
        <div className="text-lg font-bold">{user.nickname}</div>
        <p className="text-sm text-wsub mt-2">비공개 프로필입니다. 활동 내역이 공개되어 있지 않습니다.</p>
      </div>
    );
  }

  // 이 유저의 평점 전체 (프로필 통계 대부분을 여기서 계산)
  const ratings = await prisma.rating.findMany({
    where: { userId: id },
    select: {
      score: true, comment: true, createdAt: true, blinded: true,
      player: { select: { name: true, team: true } },
      match: { select: { id: true, sport: true, homeTeam: true, awayTeam: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const [likesOnRatings, likesOnDiscussions, discussionCount] = await Promise.all([
    prisma.commentLike.count({ where: { rating: { userId: id } } }),
    prisma.discussionLike.count({ where: { comment: { userId: id } } }),
    prisma.discussionComment.count({ where: { userId: id } }),
  ]);

  const ratingCount = ratings.length;
  const avg = ratingCount ? ratings.reduce((s, r) => s + r.score, 0) / ratingCount : null;
  const likesReceived = likesOnRatings + likesOnDiscussions;
  const commentCount = ratings.filter((r) => r.comment.trim()).length + discussionCount;

  // 자주 평가한 팀 TOP 3
  const teamFreq: Record<string, number> = {};
  for (const r of ratings) teamFreq[r.player.team] = (teamFreq[r.player.team] || 0) + 1;
  const topTeams = Object.entries(teamFreq).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const recent = ratings.filter((r) => !r.blinded).slice(0, 5);

  // 평점 성향 (2~9 척도)
  const pos = avg != null ? Math.max(0, Math.min(100, ((avg - 2) / 7) * 100)) : 50;
  const tendency = avg == null ? "" : avg >= 6.5 ? "후한 편" : avg <= 4.5 ? "짠 편" : "균형잡힌 편";

  const joined = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", timeZone: "Asia/Seoul" }).format(user.createdAt);
  const initial = user.nickname.slice(0, 1);

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="bg-card border rounded-xl p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-xl font-bold shrink-0">{initial}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg font-bold">{user.nickname}</span>
              {user.role === "admin" && <span className="text-xs bg-blue-50 text-blue-700 rounded-full px-2 py-0.5">운영자</span>}
              {user.emailVerified
                ? <span className="text-xs bg-green-50 text-green-700 rounded-full px-2 py-0.5">✓ 인증</span>
                : <span className="text-xs bg-wgray text-wsub rounded-full px-2 py-0.5">미인증</span>}
              {!user.profilePublic && (isOwner || viewerIsAdmin) && (
                <span className="text-xs bg-wgray text-wsub rounded-full px-2 py-0.5">🔒 비공개</span>
              )}
            </div>
            <div className="text-sm text-wsub mt-1">{joined} 가입</div>
          </div>
          {isOwner && (
            <Link href="/account" className="text-sm px-3 py-1.5 rounded border hover:bg-wgray shrink-0">프로필 편집</Link>
          )}
        </div>

        {/* 지표 4개 */}
        <div className="grid grid-cols-4 gap-2 mt-5">
          <Stat label="남긴 평점" value={ratingCount} />
          <Stat label="평균 점수" value={avg != null ? avg.toFixed(1) : "—"} />
          <Stat label="받은 좋아요" value={likesReceived} />
          <Stat label="작성 코멘트" value={commentCount} />
        </div>
      </div>

      {/* 자주 평가한 팀 */}
      {topTeams.length > 0 && (
        <div className="bg-card border rounded-xl p-5">
          <div className="text-sm text-wsub mb-2">자주 평가한 팀</div>
          <div className="flex gap-2 flex-wrap">
            {topTeams.map(([team, n]) => (
              <span key={team} className="inline-flex items-center gap-1.5 text-sm bg-wgray border rounded-full px-3 py-1.5">
                {team} <span className="text-wfaint">{n}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 평점 성향 */}
      {avg != null && (
        <div className="bg-card border rounded-xl p-5">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-wsub">평점 성향</span>
            <span className="text-amber-700 font-medium">{tendency}</span>
          </div>
          <div className="relative h-2 bg-wgray rounded-full">
            <div className="absolute w-4 h-4 rounded-full bg-amber-500 border-2 border-white top-1/2" style={{ left: `${pos}%`, transform: "translate(-50%,-50%)" }} />
          </div>
          <div className="flex justify-between text-[11px] text-wfaint mt-1">
            <span>짜게 줌</span><span>평균</span><span>후하게 줌</span>
          </div>
        </div>
      )}

      {/* 최근 평점 */}
      <div className="bg-card border rounded-xl p-5">
        <div className="text-sm text-wsub mb-3">최근 평점</div>
        {recent.length === 0 ? (
          <p className="text-sm text-wfaint">아직 남긴 평점이 없습니다.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {recent.map((r, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm">
                    {r.player.name}
                    <Link href={`/${sportPath(r.match.sport)}/${r.match.id}`} className="text-wfaint text-xs ml-1 hover:text-blue-600">
                      · {r.match.homeTeam} vs {r.match.awayTeam}
                    </Link>
                  </div>
                  {r.comment.trim() && <div className="text-xs text-wsub mt-0.5 truncate">"{r.comment.trim()}"</div>}
                </div>
                <span className="text-sm font-semibold bg-amber-100 text-amber-800 rounded px-2 py-0.5 shrink-0">{r.score}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-wgray rounded-lg py-3 text-center">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-wsub mt-0.5">{label}</div>
    </div>
  );
}
