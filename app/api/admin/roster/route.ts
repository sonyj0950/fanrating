import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { classifyPitcher } from "@/lib/kboTeams";

// KBO 로스터 관리 (관리자 전용)
// GET    ?team=LG         : 해당 팀 선수 목록 (투수/타자/말소 분류용 필드 포함)
// POST   {team, text}     : 명단 붙여넣기로 추가/재등록 ("이름" 또는 "이름,포지션" 한 줄에 한 명)
// PATCH  {playerId, ...}  : rosterActive(말소/복귀) · isPitcher(투타 전환) · position 수정

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  return !!session && (session.user as any).role === "admin";
}

export async function GET(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "권한없음" }, { status: 403 });
  const team = new URL(req.url).searchParams.get("team");
  if (!team) return NextResponse.json({ error: "team 파라미터 필요" }, { status: 400 });

  const players = await prisma.player.findMany({
    where: { team },
    orderBy: { name: "asc" },
    select: { id: true, name: true, position: true, isPitcher: true, rosterActive: true },
  });
  return NextResponse.json({ team, players });
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "권한없음" }, { status: 403 });
  const { team, text } = await req.json();
  if (!team) return NextResponse.json({ error: "team 필요" }, { status: 400 });

  const lines = (text || "").split("\n").map((l: string) => l.trim()).filter(Boolean);
  let added = 0, updated = 0;
  for (const line of lines) {
    const [name, position] = line.split(",").map((s: string) => s.trim());
    if (!name) continue;
    const isPitcher = classifyPitcher(position);
    const existing = await prisma.player.findFirst({ where: { name, team } });
    if (existing) {
      await prisma.player.update({
        where: { id: existing.id },
        data: { rosterActive: true, isPitcher, position: position || existing.position },
      });
      updated++;
    } else {
      await prisma.player.create({
        data: { name, team, position: position || null, isPitcher, rosterActive: true },
      });
      added++;
    }
  }
  return NextResponse.json({ ok: true, added, updated });
}

export async function PATCH(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "권한없음" }, { status: 403 });
  const { playerId, rosterActive, isPitcher, position } = await req.json();
  if (!playerId) return NextResponse.json({ error: "playerId 필요" }, { status: 400 });

  const data: any = {};
  if (rosterActive !== undefined) data.rosterActive = rosterActive;
  if (isPitcher !== undefined) data.isPitcher = isPitcher;
  if (position !== undefined) data.position = position;
  if (!Object.keys(data).length) return NextResponse.json({ error: "변경할 내용 없음" }, { status: 400 });

  await prisma.player.update({ where: { id: playerId }, data });
  return NextResponse.json({ ok: true });
}
