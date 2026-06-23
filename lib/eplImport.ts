import { prisma } from "@/lib/prisma";
import { teamKo, playerKo, posKo, parseGrid, gridsToPositions } from "@/lib/eplMapping";

export const API_BASE = "https://v3.football.api-sports.io";
export const EPL_LEAGUE = 39; // 프리미어리그

export async function af(path: string) {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY 환경변수가 없습니다.");
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "x-apisports-key": key },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API 응답 오류: ${res.status}`);
  return res.json();
}

export type ImportResult =
  | { ok: true; reason: "ok"; message: string; id: string; match: string; players: number; subs: number; url: string }
  | { ok: false; reason: "exists" | "notfound" | "error"; message: string; id?: string };

// 경기 1개(fixtureId)를 받아 DB에 등록. 이미 있으면 exists 반환.
export async function importFixture(fixtureId: number | string): Promise<ImportResult> {
  const fxData = await af(`/fixtures?id=${fixtureId}`);
  const f = (fxData.response || [])[0];
  if (!f) return { ok: false, reason: "notfound", message: "경기를 찾을 수 없음" };

  const homeEn = f.teams?.home?.name;
  const awayEn = f.teams?.away?.name;
  const homeKo = teamKo(homeEn);
  const awayKo = teamKo(awayEn);
  const statusShort = f.fixture?.status?.short;
  const finished = ["FT", "AET", "PEN"].includes(statusShort);
  const date = new Date(f.fixture?.date);

  const existing = await prisma.match.findFirst({
    where: { sport: "epl", homeTeam: homeKo, awayTeam: awayKo, date },
  });
  if (existing) return { ok: false, reason: "exists", message: "이미 등록된 경기", id: existing.id };

  const match = await prisma.match.create({
    data: {
      sport: "epl", date, homeTeam: homeKo, awayTeam: awayKo,
      homeScore: f.goals?.home ?? null, awayScore: f.goals?.away ?? null,
      status: finished ? "finished" : "scheduled",
    },
  });

  // 라인업 (선발 grid 좌표 + 후보)
  const luData = await af(`/fixtures/lineups?fixture=${fixtureId}`);
  let playerCount = 0;
  for (const t of (luData.response || [])) {
    const teamKoName = teamKo(t.team?.name);
    const side: "home" | "away" = teamKoName === homeKo ? "home" : "away";
    const starters = (t.startXI || []);
    const grids = starters.map((it: any) => parseGrid(it.player?.grid));
    const positions = gridsToPositions(grids, side);

    const saveOne = async (item: any, isDefault: boolean, pos?: { posX: number; posY: number } | null) => {
      const p = item.player || {};
      const nameKo = playerKo(p.name);
      const position = posKo(p.pos);
      let player = await prisma.player.findFirst({ where: { name: nameKo, team: teamKoName } });
      if (!player) player = await prisma.player.create({ data: { name: nameKo, team: teamKoName, position } });
      await prisma.matchPlayer.upsert({
        where: { matchId_playerId: { matchId: match.id, playerId: player.id } },
        create: {
          matchId: match.id, playerId: player.id, role: position, isDefault, segment: "all",
          posX: pos?.posX ?? null, posY: pos?.posY ?? null,
        },
        update: { isDefault, role: position, posX: pos?.posX ?? null, posY: pos?.posY ?? null },
      });
      playerCount++;
    };

    for (let i = 0; i < starters.length; i++) await saveOne(starters[i], true, positions[i]);
    for (const sub of (t.substitutes || [])) await saveOne(sub, false, null);
  }

  // 교체 (끝난 경기만) — subst 이벤트: player=OUT(나간), assist=IN(들어온)
  let subCount = 0;
  if (finished) {
    const evData = await af(`/fixtures/events?fixture=${fixtureId}`);
    const teamKoByApiName: Record<string, string> = { [homeEn]: homeKo, [awayEn]: awayKo };
    for (const ev of (evData.response || [])) {
      if (ev.type !== "subst") continue;
      const minute = ev.time?.elapsed ?? 0;
      const teamKoName = teamKoByApiName[ev.team?.name] ?? teamKo(ev.team?.name);
      const outName = playerKo(ev.player?.name);
      const inName = playerKo(ev.assist?.name);
      if (!inName || !outName) continue;
      const inP = await prisma.player.findFirst({ where: { name: inName, team: teamKoName } });
      const outP = await prisma.player.findFirst({ where: { name: outName, team: teamKoName } });
      if (!inP || !outP) continue;
      await prisma.substitution.create({
        data: { matchId: match.id, minute, outPlayerId: outP.id, inPlayerId: inP.id },
      });
      subCount++;
    }
  }

  return {
    ok: true, reason: "ok", message: "", id: match.id,
    match: `${homeKo} ${f.goals?.home ?? "-"} : ${f.goals?.away ?? "-"} ${awayKo}`,
    players: playerCount, subs: subCount, url: `/epl/${match.id}`,
  };
}

// 최근 끝난 EPL 경기들의 요약(id + 한글팀명 + 날짜) — 등록 여부를 DB에서 바로 확인하려고
export type FixtureSummary = { id: number; homeKo: string; awayKo: string; date: Date };

export async function recentFinishedFixtures(season: number, limit = 20): Promise<FixtureSummary[]> {
  const data = await af(`/fixtures?league=${EPL_LEAGUE}&season=${season}`);
  const all = data.response || [];
  const finished = all.filter((f: any) => ["FT", "AET", "PEN"].includes(f.fixture?.status?.short));
  finished.sort((a: any, b: any) =>
    new Date(b.fixture?.date).getTime() - new Date(a.fixture?.date).getTime());
  return finished.slice(0, limit).map((f: any) => ({
    id: f.fixture?.id,
    homeKo: teamKo(f.teams?.home?.name),
    awayKo: teamKo(f.teams?.away?.name),
    date: new Date(f.fixture?.date),
  }));
}

// 경기가 이미 등록됐는지 (API 호출 없이 DB만)
export async function isMatchRegistered(s: FixtureSummary): Promise<boolean> {
  const existing = await prisma.match.findFirst({
    where: { sport: "epl", homeTeam: s.homeKo, awayTeam: s.awayKo, date: s.date },
    select: { id: true },
  });
  return !!existing;
}

// 최근 끝난 EPL 경기들의 fixtureId 목록 (시즌 전체에서 서버 슬라이스)
export async function recentFinishedFixtureIds(season: number, limit = 10): Promise<number[]> {
  const data = await af(`/fixtures?league=${EPL_LEAGUE}&season=${season}`);
  const all = data.response || [];
  const finished = all.filter((f: any) => ["FT", "AET", "PEN"].includes(f.fixture?.status?.short));
  finished.sort((a: any, b: any) =>
    new Date(b.fixture?.date).getTime() - new Date(a.fixture?.date).getTime());
  return finished.slice(0, limit).map((f: any) => f.fixture?.id);
}
