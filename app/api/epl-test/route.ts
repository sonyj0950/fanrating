import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// API-Football EPL 데이터 테스트용 — DB에 저장하지 않고, 받아온 내용을 그대로 보여줍니다.
// 키는 서버 환경변수(API_FOOTBALL_KEY)에서만 읽으므로 외부에 노출되지 않습니다.

const API_BASE = "https://v3.football.api-sports.io";
const EPL_LEAGUE = 39; // 프리미어리그
const SEASON = 2025;   // 2025/26 시즌

async function af(path: string) {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY 환경변수가 없습니다.");
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "x-apisports-key": key },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API 응답 오류: ${res.status}`);
  const json = await res.json();
  return json;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin")
    return NextResponse.json({ error: "권한없음" }, { status: 403 });

  const url = new URL(req.url);
  const fixtureId = url.searchParams.get("fixtureId");

  try {
    // 1) 특정 경기의 라인업 조회
    if (fixtureId) {
      const data = await af(`/fixtures/lineups?fixture=${fixtureId}`);
      const lineups = (data.response || []).map((t: any) => ({
        team: t.team?.name,
        formation: t.formation,
        startXI: (t.startXI || []).map((p: any) => ({
          name: p.player?.name,
          number: p.player?.number,
          pos: p.player?.pos,
        })),
        substitutes: (t.substitutes || []).map((p: any) => ({
          name: p.player?.name,
          number: p.player?.number,
          pos: p.player?.pos,
        })),
      }));
      return NextResponse.json({
        quota: {
          limit: data.results,
          remaining: req.headers.get("x-ratelimit-requests-remaining"),
        },
        lineups,
      });
    }

    // 2) 기본: EPL 경기 목록. mode=last(최근 끝난) | next(다가오는), season 지정 가능
    const mode = url.searchParams.get("mode") === "next" ? "next" : "last";
    const season = url.searchParams.get("season") || String(SEASON);
    const data = await af(`/fixtures?league=${EPL_LEAGUE}&season=${season}&${mode}=10`);
    const fixtures = (data.response || []).map((f: any) => ({
      fixtureId: f.fixture?.id,
      date: f.fixture?.date,
      status: f.fixture?.status?.short,
      home: f.teams?.home?.name,
      away: f.teams?.away?.name,
      homeScore: f.goals?.home,
      awayScore: f.goals?.away,
      round: f.league?.round,
    }));

    return NextResponse.json({
      count: data.results,
      season,
      mode,
      fixtures,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "알 수 없는 오류" }, { status: 500 });
  }
}
