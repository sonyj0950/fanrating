import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateFootballSeed } from "@/lib/discussionSeed";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") return null;
  return session;
}

const SEED_MIN_TOTAL = 2; // 경기 전체 평점이 이만큼 모이면 시드 생성 시도

// 경기 종료 시 토론 시드 자동 생성 (축구만, 총평 평점 기준)
async function maybeGenerateSeed(matchId: string): Promise<boolean> {
  const m = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      // 모든 세그먼트(총평·전반·후반) 평점을 합쳐서 계산
      ratings: { include: { player: { select: { name: true, team: true } } } },
    },
  });
  if (!m || m.sport !== "kleague") return false;
  if (m.ratings.length < SEED_MIN_TOTAL) return false;

  const seed = generateFootballSeed({
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    ratings: m.ratings.map(r => ({
      playerId: r.playerId, name: r.player.name, team: r.player.team, score: r.score,
    })),
  });
  if (seed) {
    await prisma.match.update({ where: { id: matchId }, data: { seed } });
    return true;
  }
  return false;
}

// 골·어시스트 기록 / 경기 상태 수정
export async function PATCH(req: Request, { params }: any) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: "권한없음" }, { status: 403 });

  const b = await req.json();
  const data: any = {};
  if (typeof b.record === "string") data.record = b.record.trim() || null;
  if (typeof b.status === "string" && ["scheduled", "live", "finished"].includes(b.status))
    data.status = b.status;

  // 시드 강제 재생성 요청
  if (b.regenSeed === true) {
    const ok = await maybeGenerateSeed(params.id);
    return NextResponse.json({
      ok: true,
      regenerated: ok,
      message: ok ? "토론거리를 생성했습니다." : "평점이 부족하거나 축구 경기가 아닙니다.",
    });
  }

  if (Object.keys(data).length === 0)
    return NextResponse.json({ error: "변경할 내용이 없습니다." }, { status: 400 });

  await prisma.match.update({ where: { id: params.id }, data });

  // 종료로 바뀌면 토론 시드 생성 시도
  if (data.status === "finished") await maybeGenerateSeed(params.id);

  return NextResponse.json({ ok: true });
}

// 경기 삭제 (선수 명단·평점·대댓글 포함)
export async function DELETE(_req: Request, { params }: any) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: "권한없음" }, { status: 403 });

  const exists = await prisma.match.findUnique({ where: { id: params.id } });
  if (!exists) return NextResponse.json({ error: "경기를 찾을 수 없습니다." }, { status: 404 });

  await prisma.$transaction([
    // ※ 대댓글(Reply) 모델을 추가한 경우. 추가 전이라면 이 줄은 제거하세요.
    prisma.reply.deleteMany({ where: { rating: { matchId: params.id } } }),
    prisma.rating.deleteMany({ where: { matchId: params.id } }),
    prisma.matchPlayer.deleteMany({ where: { matchId: params.id } }),
    prisma.match.delete({ where: { id: params.id } }),
  ]);
  return NextResponse.json({ ok: true });
}
