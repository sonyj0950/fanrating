import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findFixtureId, buildGoalsRecord } from "@/lib/eplImport";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 이미 등록된 EPL 경기의 골 기록(득점 시간·득점자·도움)을 API에서 불러와 채움
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin")
    return NextResponse.json({ error: "권한없음" }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const matchId = b.matchId as string | undefined;
  if (!matchId) return NextResponse.json({ error: "matchId 필수" }, { status: 400 });

  const m = await prisma.match.findUnique({ where: { id: matchId } });
  if (!m) return NextResponse.json({ error: "경기를 찾을 수 없습니다." }, { status: 404 });
  if (m.sport !== "epl")
    return NextResponse.json({ error: "EPL 자동 경기만 지원합니다." }, { status: 400 });

  try {
    const fixtureId = await findFixtureId(m.homeTeam, m.awayTeam, m.date);
    if (!fixtureId)
      return NextResponse.json({ ok: false, message: "API에서 해당 경기를 찾지 못했습니다. (시즌/팀명/시간 불일치)" });

    const record = await buildGoalsRecord(fixtureId);
    if (!record)
      return NextResponse.json({ ok: false, message: "이 경기의 골 데이터가 API에 없습니다." });

    await prisma.match.update({ where: { id: matchId }, data: { record } });
    return NextResponse.json({ ok: true, record });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e.message }, { status: 500 });
  }
}
