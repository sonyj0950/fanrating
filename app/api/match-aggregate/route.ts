import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const matchId = searchParams.get("matchId");
  if (!matchId) return NextResponse.json({ error: "bad" }, { status: 400 });

  const ratings = await prisma.rating.findMany({
    where: { matchId },
    select: { playerId: true, score: true, segment: true },
  });
  const map: Record<string, Record<string, { sum: number; count: number }>> = {};
  for (const r of ratings) {
    map[r.segment] ||= {};
    map[r.segment][r.playerId] ||= { sum: 0, count: 0 };
    map[r.segment][r.playerId].sum += r.score;
    map[r.segment][r.playerId].count++;
  }
  const out: Record<string, Record<string, { avg: number; count: number }>> = {};
  for (const seg of Object.keys(map)) {
    out[seg] = {};
    for (const pid of Object.keys(map[seg])) {
      const a = map[seg][pid];
      out[seg][pid] = { avg: Number((a.sum / a.count).toFixed(2)), count: a.count };
    }
  }
  return NextResponse.json(out);
}
