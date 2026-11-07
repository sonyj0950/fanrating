import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { verificationBlock } from "@/lib/verified";

// 평점 일괄 등록 — 한 경기에 여러 (선수·구간) 점수를 한 번에 upsert.
//  · 축구·LoL 전체 평점: 선수마다 segment="full" 한 줄
//  · 평점 모달(M안): 한 선수의 full + 상세 세트/전후반 여러 줄
// items: [{ playerId, segment, score, comment? }]  (comment 없으면 기존 코멘트 보존)
// rate limit은 요청당 1회만 차감(단건 반복 대비 핵심 이점).
type Item = { playerId: string; segment: string; score: number; comment?: string };

const SEG_ORDER: Record<string, string[]> = {
  kleague: ["first", "second"],
  epl: ["first", "second"],
  kbo: ["first", "second"],
  lck: ["set1", "set2", "set3", "set4", "set5"],
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const userId = (session.user as any).id;
  if (!(await rateLimit("write", `u:${userId}`)))
    return NextResponse.json({ error: "요청이 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  const blocked = await verificationBlock(userId);
  if (blocked) return NextResponse.json({ error: blocked }, { status: 403 });

  const b = await req.json();
  const items: Item[] = Array.isArray(b.items) ? b.items : [];
  if (!b.matchId || items.length === 0)
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  if (items.length > 60)
    return NextResponse.json({ error: "한 번에 60개까지 등록할 수 있습니다." }, { status: 400 });

  const match = await prisma.match.findUnique({ where: { id: b.matchId } });
  if (!match) return NextResponse.json({ error: "경기를 찾을 수 없습니다." }, { status: 404 });
  if (match.status === "scheduled")
    return NextResponse.json({ error: "경기 시작 후 평점을 매길 수 있습니다." }, { status: 403 });
  const order = SEG_ORDER[match.sport] ?? ["first", "second"];

  for (const it of items) {
    const score = Number(it?.score);
    if (!it?.playerId || score < 1 || score > 10 || !Number.isInteger(score * 10))
      return NextResponse.json({ error: "평점은 1.0~10.0 사이의 0.1점 단위여야 합니다." }, { status: 400 });
    const seg = it.segment || "full";
    if (seg !== "full") {
      const idx = order.indexOf(seg);
      if (idx < 0) return NextResponse.json({ error: "잘못된 구간" }, { status: 400 });
      // live: 첫 구간만 허용, 이후 구간은 종료 후
      if (match.status === "live" && idx > 0)
        return NextResponse.json({ error: "해당 구간은 경기 종료 후 입력할 수 있습니다." }, { status: 403 });
    }
  }

  // 이 경기에 실제로 등록된 선수만 저장 (임의 playerId 차단)
  const valid = new Set(
    (await prisma.matchPlayer.findMany({ where: { matchId: b.matchId }, select: { playerId: true } }))
      .map(mp => mp.playerId));
  const toSave = items.filter(it => valid.has(it.playerId));
  if (toSave.length === 0) return NextResponse.json({ error: "저장할 선수가 없습니다." }, { status: 400 });

  await prisma.$transaction(toSave.map(it => {
    const segment = it.segment || "full";
    const score = Number(it.score);
    const hasComment = typeof it.comment === "string";
    const comment = hasComment ? (it.comment as string).trim() : "";
    return prisma.rating.upsert({
      where: { matchId_playerId_userId_segment: { matchId: b.matchId, playerId: it.playerId, userId, segment } },
      // 코멘트가 넘어온 항목만 코멘트 갱신 (없으면 기존 코멘트 보존)
      update: hasComment ? { score, comment } : { score },
      create: { matchId: b.matchId, playerId: it.playerId, userId, segment, score, comment },
    });
  }));
  return NextResponse.json({ ok: true, saved: toSave.length });
}
