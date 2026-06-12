import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin")
    return NextResponse.json({ error: "권한없음" }, { status: 403 });

  const b = await req.json();
  if (!b.homeTeam || !b.awayTeam) return NextResponse.json({ error: "팀명 필수" }, { status: 400 });

  // datetime-local 입력("YYYY-MM-DDTHH:mm")을 한국 시간(KST)으로 해석
  const parseKST = (s: string) =>
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) ? new Date(s + ":00+09:00") : new Date(s);

  const match = await prisma.match.create({
    data: {
      sport: b.sport, date: parseKST(b.date),
      homeTeam: b.homeTeam, awayTeam: b.awayTeam,
      homeScore: b.homeScore ? Number(b.homeScore) : null,
      awayScore: b.awayScore ? Number(b.awayScore) : null,
      status: b.status,
    },
  });

  const lines = (b.players || "").split("\n").map((l:string)=>l.trim()).filter(Boolean);
  for (const line of lines) {
    const parts = line.split(",").map((s:string)=>s.trim());
    const [name, team, position, role, prio, half] = parts;
    if (!name || !team) continue;
    const isDefault = (prio || "").toUpperCase() === "P" || b.sport !== "kbo";
    // 6번째 필드: 출전 구간 (전/전반 → first, 후/후반 → second, 그 외 → 전·후반)
    const h = (half || "").trim();
    const segment = ["전", "전반"].includes(h) ? "first"
      : ["후", "후반"].includes(h) ? "second" : "all";
    let player = await prisma.player.findFirst({ where: { name, team } });
    if (!player) player = await prisma.player.create({ data: { name, team, position } });
    await prisma.matchPlayer.create({ data: { matchId: match.id, playerId: player.id, role, isDefault, segment } });
  }

  return NextResponse.json({ ok: true, id: match.id });
}
