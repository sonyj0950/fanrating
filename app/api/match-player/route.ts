import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  if ((session.user as any).role !== "admin")
    return NextResponse.json({ error: "권한없음" }, { status: 403 });

  const { matchId, name, team, role, segment, isDefault } = await req.json();
  if (!matchId || !name || !team) return NextResponse.json({ error: "필수값 누락" }, { status: 400 });

  let player = await prisma.player.findFirst({ where: { name, team } });
  if (!player) player = await prisma.player.create({ data: { name, team, position: role } });

  const exists = await prisma.matchPlayer.findUnique({
    where: { matchId_playerId: { matchId, playerId: player.id } },
  });
  if (exists) return NextResponse.json({ ok: true, id: exists.id });

  const mp = await prisma.matchPlayer.create({
    data: { matchId, playerId: player.id, role, isDefault: isDefault === true,
      segment: ["first", "second"].includes(segment) ? segment : "all" },
  });
  return NextResponse.json({ ok: true, id: mp.id });
}
