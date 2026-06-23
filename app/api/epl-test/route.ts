import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { teamKo, playerKo, posKo } from "@/lib/eplMapping";

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
  const action = url.searchParams.get("action");

  try {
    // 0) 우리 키로 접근 가능한 EPL 시즌 목록 확인
    if (action === "seasons") {
      const data = await af(`/leagues?id=${EPL_LEAGUE}`);
      const league = (data.response || [])[0];
      const seasons = (league?.seasons || []).map((s: any) => ({
        year: s.year,
        start: s.start,
        end: s.end,
        current: s.current,
        lineups: s.coverage?.fixtures?.lineups,
      }));
      return NextResponse.json({ count: seasons.length, seasons });
    }

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

    // 2) 기본: 시즌 전체를 받아 서버에서 최근 끝난/다가오는 10경기를 골라냄 (요청 1건)
    const mode = url.searchParams.get("mode") === "next" ? "next" : "last";
    const season = url.searchParams.get("season") || String(SEASON);
    const data = await af(`/fixtures?league=${EPL_LEAGUE}&season=${season}`);
    const all = (data.response || []);
    const finished = all.filter((f: any) => ["FT", "AET", "PEN"].includes(f.fixture?.status?.short));
    const upcoming = all.filter((f: any) => ["NS", "TBD"].includes(f.fixture?.status?.short));
    const byDate = (arr: any[], desc: boolean) =>
      [...arr].sort((a, b) => {
        const ta = new Date(a.fixture?.date).getTime();
        const tb = new Date(b.fixture?.date).getTime();
        return desc ? tb - ta : ta - tb;
      });
    const picked = mode === "next" ? byDate(upcoming, false).slice(0, 10) : byDate(finished, true).slice(0, 10);
    const fixtures = picked.map((f: any) => ({
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
      count: picked.length,
      total: all.length,
      season,
      mode,
      fixtures,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "알 수 없는 오류" }, { status: 500 });
  }
}

// POST: 선택한 EPL 경기 1개 + 라인업을 실제 DB에 저장 (관리자)
// body: { fixtureId }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin")
    return NextResponse.json({ error: "권한없음" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const fixtureId = body.fixtureId;
  if (!fixtureId) return NextResponse.json({ error: "fixtureId 필요" }, { status: 400 });

  try {
    // 1) 경기 기본 정보
    const fxData = await af(`/fixtures?id=${fixtureId}`);
    const f = (fxData.response || [])[0];
    if (!f) return NextResponse.json({ error: "경기를 찾을 수 없음" }, { status: 404 });

    const homeEn = f.teams?.home?.name;
    const awayEn = f.teams?.away?.name;
    const homeKo = teamKo(homeEn);
    const awayKo = teamKo(awayEn);
    const statusShort = f.fixture?.status?.short;
    const finished = ["FT", "AET", "PEN"].includes(statusShort);

    // 이미 등록된 경기면 중복 생성 방지 (같은 sport+팀+날짜)
    const date = new Date(f.fixture?.date);
    const existing = await prisma.match.findFirst({
      where: { sport: "epl", homeTeam: homeKo, awayTeam: awayKo, date },
    });
    if (existing) {
      return NextResponse.json({ error: "이미 등록된 경기입니다.", id: existing.id }, { status: 409 });
    }

    const match = await prisma.match.create({
      data: {
        sport: "epl",
        date,
        homeTeam: homeKo,
        awayTeam: awayKo,
        homeScore: f.goals?.home ?? null,
        awayScore: f.goals?.away ?? null,
        status: finished ? "finished" : "scheduled",
      },
    });

    // 2) 라인업 (선발 + 후보)
    const luData = await af(`/fixtures/lineups?fixture=${fixtureId}`);
    let playerCount = 0;
    for (const t of (luData.response || [])) {
      const teamKoName = teamKo(t.team?.name);
      const addPlayers = async (arr: any[], isDefault: boolean) => {
        for (const item of (arr || [])) {
          const p = item.player || {};
          const nameKo = playerKo(p.name);
          const position = posKo(p.pos);
          let player = await prisma.player.findFirst({ where: { name: nameKo, team: teamKoName } });
          if (!player) player = await prisma.player.create({ data: { name: nameKo, team: teamKoName, position } });
          await prisma.matchPlayer.upsert({
            where: { matchId_playerId: { matchId: match.id, playerId: player.id } },
            create: { matchId: match.id, playerId: player.id, role: position, isDefault, segment: "all" },
            update: { isDefault, role: position },
          });
          playerCount++;
        }
      };
      await addPlayers(t.startXI, true);   // 선발
      await addPlayers(t.substitutes, false); // 후보
    }

    return NextResponse.json({
      ok: true,
      id: match.id,
      match: `${homeKo} ${f.goals?.home ?? "-"} : ${f.goals?.away ?? "-"} ${awayKo}`,
      players: playerCount,
      url: `/epl/${match.id}`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "알 수 없는 오류" }, { status: 500 });
  }
}
