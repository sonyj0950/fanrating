import { prisma } from "@/lib/prisma";
import { teamKo, roleToLane, stripTeamPrefix } from "@/lib/lckMapping";

// LoL Esports API (비공식) — 키 발급 불필요, 프론트 공개키 사용. 환경변수로 override 가능.
const API_KEY = process.env.LOLESPORTS_API_KEY || "0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z";
const ESPORTS_BASE = "https://esports-api.lolesports.com/persisted/gw";
const LIVESTATS_BASE = "https://feed.lolesports.com/livestats/v1";
export const LCK_LEAGUE_ID = "98767991310872058";

export async function lolEsports(path: string) {
  const res = await fetch(`${ESPORTS_BASE}${path}`, {
    headers: { "x-api-key": API_KEY },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`LoL Esports API 오류: ${res.status}`);
  return res.json();
}

// 세트(game) 1개의 라인업·챔피언 메타데이터. 키 불필요. 실패 시 null.
async function livestats(gameId: string) {
  try {
    const res = await fetch(`${LIVESTATS_BASE}/window/${gameId}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// strict:false 환경이라 discriminated union 좁히기가 약해 평탄한 단일 타입으로 둔다.
export type ImportResult = {
  ok: boolean;
  reason: "ok" | "updated" | "exists" | "notfound" | "error";
  id?: string;
  match?: string;
  players?: number;
  url?: string;
  warning?: string;
  message?: string;
};

export type MatchSummary = {
  id: string;
  homeKo: string;
  awayKo: string;
  date: Date;
  homeWins: number | null;
  awayWins: number | null;
};

// LCK 스케줄에서 끝난 경기들 (최신순)
export async function recentCompletedMatches(limit = 20): Promise<MatchSummary[]> {
  const data = await lolEsports(`/getSchedule?hl=en-US&leagueId=${LCK_LEAGUE_ID}`);
  const events: any[] = data?.data?.schedule?.events || [];
  const completed = events.filter(e => e.match && e.state === "completed");
  completed.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  return completed.slice(0, limit).map(e => {
    const [h, a] = e.match.teams;
    return {
      id: String(e.match.id),
      homeKo: teamKo(h?.name),
      awayKo: teamKo(a?.name),
      date: new Date(e.startTime),
      homeWins: h?.result?.gameWins ?? null,
      awayWins: a?.result?.gameWins ?? null,
    };
  });
}

// 이미 등록됐는지 (API 호출 없이 DB만)
export async function isMatchRegistered(s: MatchSummary): Promise<boolean> {
  const ex = await prisma.match.findFirst({
    where: { sport: "lck", homeTeam: s.homeKo, awayTeam: s.awayKo, date: s.date },
    select: { id: true },
  });
  return !!ex;
}

// LoL Esports 경기 상태 → 우리 status
function mapState(state?: string): "scheduled" | "live" | "finished" {
  if (state === "completed") return "finished";
  if (state === "inProgress") return "live";
  return "scheduled";
}

// getEventDetails엔 날짜·상태가 없으므로 스케줄에서 보완한다.
async function findMatchInfo(matchId: string): Promise<{ date: Date | null; state?: string }> {
  const data = await lolEsports(`/getSchedule?hl=en-US&leagueId=${LCK_LEAGUE_ID}`);
  const events: any[] = data?.data?.schedule?.events || [];
  const e = events.find(x => x.match && String(x.match.id) === String(matchId));
  return e ? { date: new Date(e.startTime), state: e.state } : { date: null };
}

// 관리자 선택용: 진행중 → 예정 → 최근 종료 순 경기 목록 (state 포함)
export type MatchListItem = {
  id: string; label: string; date: Date;
  state: "scheduled" | "live" | "finished";
};
export async function listMatches(limit = 30): Promise<MatchListItem[]> {
  const data = await lolEsports(`/getSchedule?hl=en-US&leagueId=${LCK_LEAGUE_ID}`);
  const events: any[] = data?.data?.schedule?.events || [];
  const withMatch = events.filter(e => e.match);
  const toItem = (e: any): MatchListItem => {
    const [h, a] = e.match.teams;
    const hw = h?.result?.gameWins, aw = a?.result?.gameWins;
    const score = hw != null && aw != null ? ` ${hw}:${aw} ` : " vs ";
    return {
      id: String(e.match.id),
      label: `${teamKo(h?.name)}${score}${teamKo(a?.name)}`,
      date: new Date(e.startTime),
      state: mapState(e.state),
    };
  };
  const live = withMatch.filter(e => e.state === "inProgress").map(toItem)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const upcoming = withMatch.filter(e => e.state === "unstarted").map(toItem)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const finished = withMatch.filter(e => e.state === "completed").map(toItem)
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  return [...live, ...upcoming, ...finished].slice(0, limit);
}

// 완료된 세트들의 라인업·세트별 챔피언 수집 (livestats)
type CollectedPlayer = { side: "home" | "away"; name: string; lane: string; champions: Record<string, string> };
async function collectLineup(
  ev: any,
  sideOf: (id: any) => "home" | "away" | null,
  teamCodeOf: (s: "home" | "away") => any,
): Promise<CollectedPlayer[]> {
  const collected = new Map<string, CollectedPlayer>(); // key = side|name
  const games = (ev.match.games || [])
    .filter((g: any) => g.state === "completed")
    .sort((a: any, b: any) => (a.number || 0) - (b.number || 0));
  for (const g of games) {
    const setKey = `set${g.number}`;
    const win = await livestats(String(g.id));
    const meta = win?.gameMetadata;
    if (!meta) continue;
    for (const tmKey of ["blueTeamMetadata", "redTeamMetadata"]) {
      const tm = meta[tmKey];
      if (!tm) continue;
      const side = sideOf(tm.esportsTeamId);
      if (!side) continue;
      const code = teamCodeOf(side);
      for (const pm of tm.participantMetadata || []) {
        const name = stripTeamPrefix(pm.summonerName, code);
        if (!name) continue;
        const lane = roleToLane(pm.role);
        const key = `${side}|${name}`;
        let p = collected.get(key);
        if (!p) { p = { side, name, lane, champions: {} }; collected.set(key, p); }
        if (!p.lane && lane) p.lane = lane;
        if (pm.championId) p.champions[setKey] = pm.championId;
      }
    }
  }
  return Array.from(collected.values());
}

// 라인업을 DB에 반영. resync=true면 기존 MatchPlayer를 upsert(챔피언/라인 갱신).
async function persistLineup(
  matchId: string,
  list: CollectedPlayer[],
  teamKoOf: (s: "home" | "away") => string,
  resync: boolean,
): Promise<number> {
  if (!list.length) return 0;
  const key = (team: string, name: string) => `${team}|${name}`;

  const uniq = new Map<string, { name: string; team: string; position: string }>();
  for (const p of list) {
    const team = teamKoOf(p.side);
    const k = key(team, p.name);
    if (!uniq.has(k)) uniq.set(k, { name: p.name, team, position: p.lane });
  }
  const pairs = Array.from(uniq.values());
  const idMap = new Map<string, string>();

  const exist = await prisma.player.findMany({
    where: { OR: pairs.map(p => ({ name: p.name, team: p.team })) },
    select: { id: true, name: true, team: true },
  });
  for (const p of exist) idMap.set(key(p.team, p.name), p.id);

  const toCreate = pairs.filter(p => !idMap.has(key(p.team, p.name)));
  if (toCreate.length) {
    await prisma.player.createMany({ data: toCreate.map(p => ({ name: p.name, team: p.team, position: p.position })) });
    const created = await prisma.player.findMany({
      where: { OR: toCreate.map(p => ({ name: p.name, team: p.team })) },
      select: { id: true, name: true, team: true },
    });
    for (const p of created) idMap.set(key(p.team, p.name), p.id);
  }

  const seen = new Set<string>();
  let count = 0;
  if (resync) {
    for (const p of list) {
      const pid = idMap.get(key(teamKoOf(p.side), p.name));
      if (!pid || seen.has(pid)) continue;
      seen.add(pid);
      const champions = Object.keys(p.champions).length ? p.champions : undefined;
      await prisma.matchPlayer.upsert({
        where: { matchId_playerId: { matchId, playerId: pid } },
        update: { role: p.lane || null, champions },
        create: { matchId, playerId: pid, role: p.lane || null, isDefault: true, segment: "all", champions },
      });
      count++;
    }
  } else {
    const mpData: any[] = [];
    for (const p of list) {
      const pid = idMap.get(key(teamKoOf(p.side), p.name));
      if (!pid || seen.has(pid)) continue;
      seen.add(pid);
      mpData.push({
        matchId, playerId: pid, role: p.lane || null, isDefault: true, segment: "all",
        champions: Object.keys(p.champions).length ? p.champions : undefined,
      });
    }
    if (mpData.length) await prisma.matchPlayer.createMany({ data: mpData });
    count = mpData.length;
  }
  return count;
}

// 경기 1개를 받아 DB 등록(또는 이미 있으면 재동기화).
// opts.date/state를 주면 스케줄 재조회를 생략(cron에서 활용).
export async function importMatch(
  matchId: string,
  opts?: { date?: Date; state?: string },
): Promise<ImportResult> {
  const evData = await lolEsports(`/getEventDetails?hl=en-US&id=${matchId}`);
  const ev = evData?.data?.event;
  if (!ev || !ev.match || !Array.isArray(ev.match.teams) || ev.match.teams.length < 2)
    return { ok: false, reason: "notfound", message: "경기를 찾을 수 없음" };

  const [homeT, awayT] = ev.match.teams;
  const homeKo = teamKo(homeT?.name);
  const awayKo = teamKo(awayT?.name);

  let date = opts?.date;
  let state = opts?.state;
  if (!date || !state) {
    const info = await findMatchInfo(matchId);
    date = date ?? info.date ?? undefined;
    state = state ?? info.state;
  }
  if (!date) return { ok: false, reason: "error", message: "경기 날짜를 찾을 수 없음 (스케줄 범위 밖)" };
  const status = mapState(state);

  // esportsTeamId → home/away
  const sideOf = (id: any): "home" | "away" | null =>
    String(id) === String(homeT?.id) ? "home" : String(id) === String(awayT?.id) ? "away" : null;
  const teamKoOf = (side: "home" | "away") => (side === "home" ? homeKo : awayKo);
  const teamCodeOf = (side: "home" | "away") => (side === "home" ? homeT?.code : awayT?.code);

  const homeScore = homeT?.result?.gameWins ?? null;
  const awayScore = awayT?.result?.gameWins ?? null;

  const existing = await prisma.match.findFirst({
    where: { sport: "lck", homeTeam: homeKo, awayTeam: awayKo, date },
    select: { id: true },
  });

  let id: string;
  const resync = !!existing;
  if (existing) {
    id = existing.id;
    await prisma.match.update({ where: { id }, data: { homeScore, awayScore, status } });
  } else {
    const created = await prisma.match.create({
      data: { sport: "lck", date, homeTeam: homeKo, awayTeam: awayKo, homeScore, awayScore, status },
    });
    id = created.id;
  }

  const list = await collectLineup(ev, sideOf, teamCodeOf);
  const playerCount = await persistLineup(id, list, teamKoOf, resync);

  return {
    ok: true, reason: resync ? "updated" : "ok", id,
    match: `${homeKo} ${homeScore ?? "-"} : ${awayScore ?? "-"} ${awayKo}`,
    players: playerCount,
    url: `/lck/${id}`,
    warning: playerCount === 0
      ? "라인업 데이터 없음 (아직 끝난 세트가 없거나 livestats 미제공) — 세트 종료 후 다시 갱신하세요"
      : undefined,
  };
}
