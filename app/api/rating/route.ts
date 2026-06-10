import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 평점 등록/수정 — 코멘트는 선택 사항
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const b = await req.json();
  const score = Number(b.score);
  if (!b.matchId || !b.playerId)
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  if (!Number.isInteger(score) || score < 1 || score > 10)
    return NextResponse.json({ error: "평점은 1~10 사이여야 합니다." }, { status: 400 });

  const segment = typeof b.segment === "string" && b.segment ? b.segment : "full";
  const comment = (b.comment || "").trim();

  // 경기 상태 기반 구간 잠금 (UI를 우회한 직접 요청도 차단)
  const match = await prisma.match.findUnique({ where: { id: b.matchId } });
  if (!match) return NextResponse.json({ error: "경기를 찾을 수 없습니다." }, { status: 404 });

  // 종목별 평점 가능 구간 순서 (full=총평 제외)
  const SEG_ORDER: Record<string, string[]> = {
    kleague: ["first", "second"],
    kbo: ["first", "second"],
    lck: ["set1", "set2", "set3", "set4", "set5"],
  };
  const order = SEG_ORDER[match.sport] ?? ["first", "second"];

  if (segment !== "full") {
    const idx = order.indexOf(segment);
    if (match.status === "scheduled")
      return NextResponse.json({ error: "경기 시작 후 평점을 매길 수 있습니다." }, { status: 403 });
    // live: 첫 구간(idx 0)만 허용, 이후 구간은 종료 후
    if (match.status === "live" && idx > 0)
      return NextResponse.json({ error: "해당 구간은 경기 종료 후 입력할 수 있습니다." }, { status: 403 });
  }

  // 코멘트는 선택 사항이며 길이·문자 제한 없음 (빈 값 허용)

  const userId = (session.user as any).id;
  await prisma.rating.upsert({
    where: { matchId_playerId_userId_segment: { matchId: b.matchId, playerId: b.playerId, userId, segment } },
    update: { score, comment },
    create: { matchId: b.matchId, playerId: b.playerId, userId, segment, score, comment },
  });
  return NextResponse.json({ ok: true });
}
