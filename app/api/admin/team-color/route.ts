import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OFFICIAL_TEAM_COLORS } from "@/lib/teamColors";

// 구단 색상 오버라이드 (관리자 전용)
// GET            : 모든 오버라이드 { team: color }
// POST {team,color}: 저장(공식색과 같으면 행 삭제 = 기본 복귀)
// DELETE ?team=  : 해당 팀 오버라이드 제거(기본 복귀)

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  return !!session && (session.user as any).role === "admin";
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "권한없음" }, { status: 403 });
  const rows = await prisma.teamColor.findMany();
  const map: Record<string, string> = {};
  for (const r of rows) map[r.team] = r.color;
  return NextResponse.json({ overrides: map });
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "권한없음" }, { status: 403 });
  const { team, color } = await req.json();
  if (!team || typeof team !== "string") return NextResponse.json({ error: "team 필요" }, { status: 400 });
  if (!HEX.test(color || "")) return NextResponse.json({ error: "color 형식(#RRGGBB) 오류" }, { status: 400 });

  const hex = (color as string).toUpperCase();
  // 공식색과 동일하면 오버라이드 불필요 → 삭제(기본 복귀)
  if ((OFFICIAL_TEAM_COLORS[team] || "").toUpperCase() === hex) {
    await prisma.teamColor.deleteMany({ where: { team } });
    return NextResponse.json({ ok: true, reverted: true });
  }
  await prisma.teamColor.upsert({
    where: { team }, update: { color: hex }, create: { team, color: hex },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "권한없음" }, { status: 403 });
  const team = new URL(req.url).searchParams.get("team");
  if (!team) return NextResponse.json({ error: "team 필요" }, { status: 400 });
  await prisma.teamColor.deleteMany({ where: { team } });
  return NextResponse.json({ ok: true });
}
