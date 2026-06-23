import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listMatches, importMatch } from "@/lib/lckImport";

// LCK 수동 등록/진단용 (관리자)
// GET           : 진행중·예정·최근 종료 LCK 경기 목록 (등록 안 함)
// POST {matchId}: 해당 경기 1개 즉시 등록 (이미 있으면 최신 데이터로 갱신)

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") return false;
  return true;
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "권한없음" }, { status: 403 });
  try {
    const matches = await listMatches(30);
    return NextResponse.json({
      count: matches.length,
      matches: matches.map(m => ({
        id: m.id,
        label: m.label,
        date: m.date.toISOString(),
        state: m.state,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "알 수 없는 오류" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "권한없음" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const matchId = body.matchId;
  if (!matchId) return NextResponse.json({ error: "matchId 필요" }, { status: 400 });
  try {
    const r = await importMatch(String(matchId));
    if (!r.ok) {
      const status = r.reason === "exists" ? 409 : r.reason === "notfound" ? 404 : 500;
      return NextResponse.json({ error: r.message, id: r.id }, { status });
    }
    return NextResponse.json({ ok: true, reason: r.reason, id: r.id, match: r.match, players: r.players, url: r.url, warning: r.warning });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "알 수 없는 오류" }, { status: 500 });
  }
}
