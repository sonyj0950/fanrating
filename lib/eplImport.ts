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

  // 라인업 (선발 grid 좌표 + 후보) — DB 왕복 최소화를 위해 한 번에 묶어서 처리
  const luData = await af(`/fixtures/lineups?fixture=${fixtureId}`);
  type LItem = { name: string; team: string; position: string; isDefault: boolean; posX: number | null; posY: number | null };
  const items: LItem[] = [];
  for (const t of (luData.response || [])) {
    const teamKoName = teamKo(t.team?.name);
    const side: "home" | "away" = teamKoName === homeKo ? "home" : "away";
    const starters = (t.startXI || []);
    const grids = starters.map((it: any) => parseGrid(it.player?.grid));
    const positions = gridsToPositions(grids, side);
    starters.forEach((it: any, i: number) => {
      items.push({
        name: playerKo(it.player?.name), team: teamKoName, position: posKo(it.player?.pos),
        isDefault: true, posX: positions[i]?.posX ?? null, posY: positions[i]?.posY ?? null,
      });
    });
    for (const sub of (t.substitutes || [])) {
      items.push({
        name: playerKo(sub.player?.name), team: teamKoName, position: posKo(sub.player?.pos),
        isDefault: false, posX: null, posY: null,
      });
    }
  }

  const key = (team: string, name: string) => `${team}|${name}`;
  // 유니크 (팀,이름) 목록
  const uniq = new Map<string, { name: string; team: string; position: string }>();
  for (const it of items) {
    const k = key(it.team, it.name);
    if (it.name && !uniq.has(k)) uniq.set(k, { name: it.name, team: it.team, position: it.position });
  }
  const pairs = [...uniq.values()];
  const idMap = new Map<string, string>();

  // 1) 기존 선수 한 번에 조회
  if (pairs.length) {
    const existing = await prisma.player.findMany({
      where: { OR: pairs.map(p => ({ name: p.name, team: p.team })) },
      select: { id: true, name: true, team: true },
    });
    for (const p of existing) idMap.set(key(p.team, p.name), p.id);
  }
  // 2) 없는 선수만 한 번에 생성 후, id 다시 조회
  const toCreate = pairs.filter(p => !idMap.has(key(p.team, p.name)));
  if (toCreate.length) {
    await prisma.player.createMany({
      data: toCreate.map(p => ({ name: p.name, team: p.team, position: p.position })),
    });
    const created = await prisma.player.findMany({
      where: { OR: toCreate.map(p => ({ name: p.name, team: p.team })) },
      select: { id: true, name: true, team: true },
    });
    for (const p of created) idMap.set(key(p.team, p.name), p.id);
  }

  // 3) matchPlayer 한 번에 생성 (새 경기라 충돌 없음, playerId 중복만 제거)
  const seen = new Set<string>();
  const mpData: any[] = [];
  for (const it of items) {
    const pid = idMap.get(key(it.team, it.name));
    if (!pid || seen.has(pid)) continue;
    seen.add(pid);
    mpData.push({
      matchId: match.id, playerId: pid, role: it.position, isDefault: it.isDefault, segment: "all",
      posX: it.posX, posY: it.posY,
    });
  }
  if (mpData.length) await prisma.matchPlayer.createMany({ data: mpData });
  const playerCount = mpData.length;

  // 교체 (끝난 경기만) — subst: player=OUT(나간), assist=IN(들어온). idMap으로 DB 조회 없이 매핑
  let subCount = 0;
  if (finished) {
    const evData = await af(`/fixtures/events?fixture=${fixtureId}`);
    const teamKoByApiName: Record<string, string> = { [homeEn]: homeKo, [awayEn]: awayKo };
    const subData: any[] = [];
    for (const ev of (evData.response || [])) {
      if (ev.type !== "subst") continue;
      const minute = ev.time?.elapsed ?? 0;
      const teamKoName = teamKoByApiName[ev.team?.name] ?? teamKo(ev.team?.name);
      const outName = playerKo(ev.player?.name);
      const inName = playerKo(ev.assist?.name);
      if (!inName || !outName) continue;
      const outId = idMap.get(key(teamKoName, outName));
      const inId = idMap.get(key(teamKoName, inName));
      if (!outId || !inId) continue;
      subData.push({ matchId: match.id, minute, outPlayerId: outId, inPlayerId: inId });
    }
    if (subData.length) await prisma.substitution.createMany({ data: subData });
    subCount = subData.length;
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
