import { prisma } from "@/lib/prisma";
import { af, EPL_LEAGUE } from "@/lib/eplImport";
import { teamKo } from "@/lib/eplMapping";

export type StandingRow = {
  rank: number; team: string;
  played: number | null; win: number | null; draw: number | null; loss: number | null;
  points: number | null; note: string | null;
};

// 종목 탭 → 표시할 리그 (축구 탭은 EPL 우선)
export const TAB_LEAGUE: Record<string, string> = { soccer: "epl", baseball: "kbo", lol: "lck" };

// 홈 순위표에서 당분간 숨길 리그 (데이터 준비 전). 재노출하려면 여기서 제거.
export const HOME_HIDDEN_LEAGUES = new Set<string>(["kbo", "lck"]);

// 축구(EPL/K리그)는 시즌 중(8월~익년 5월)에만 노출. 비시즌(6·7월) 숨김.
export function soccerInSeason(kstMonth: number): boolean {
  return kstMonth >= 8 || kstMonth <= 5;
}

// 홈에 해당 리그 순위표를 보일지
export function standingsVisibleOnHome(league: string, kstMonth: number): boolean {
  if (HOME_HIDDEN_LEAGUES.has(league)) return false;
  if (league === "epl" || league === "kleague") return soccerInSeason(kstMonth);
  return true;
}

// 리그별 표시 컬럼 (홈 순위표 렌더용). key는 StandingRow 필드 또는 파생("rate").
export const LEAGUE_COLUMNS: Record<string, { key: string; label: string }[]> = {
  epl: [
    { key: "played", label: "경기" }, { key: "win", label: "승" }, { key: "draw", label: "무" },
    { key: "loss", label: "패" }, { key: "note", label: "득실" }, { key: "points", label: "승점" },
  ],
  kbo: [
    { key: "played", label: "경기" }, { key: "win", label: "승" }, { key: "loss", label: "패" },
    { key: "draw", label: "무" }, { key: "rate", label: "승률" }, { key: "note", label: "게임차" },
  ],
  lck: [
    { key: "win", label: "승" }, { key: "loss", label: "패" },
    { key: "note", label: "세트" }, { key: "rate", label: "승률" },
  ],
  kleague: [
    { key: "played", label: "경기" }, { key: "win", label: "승" }, { key: "draw", label: "무" },
    { key: "loss", label: "패" }, { key: "note", label: "득실" }, { key: "points", label: "승점" },
  ],
};

// 승률 (무 제외, 소수 3자리 ".XXX")
export function winRate(r: StandingRow): string {
  const w = r.win ?? 0, l = r.loss ?? 0;
  const d = w + l;
  if (d === 0) return "-";
  return (w / d).toFixed(3).replace(/^0/, "");
}

// 해당 리그 순위 행 전체 교체 (트랜잭션)
export async function replaceStandings(league: string, rows: StandingRow[], asOf?: Date) {
  const when = asOf ?? new Date();
  await prisma.$transaction([
    prisma.standing.deleteMany({ where: { league } }),
    prisma.standing.createMany({
      data: rows.map(r => ({ league, asOf: when, ...r })),
    }),
  ]);
  return rows.length;
}

// ⚽ EPL 순위 자동 동기화 (API-Football /standings)
export async function syncEplStandings(season: number): Promise<number> {
  const data = await af(`/standings?league=${EPL_LEAGUE}&season=${season}`);
  const table = data.response?.[0]?.league?.standings?.[0];
  if (!Array.isArray(table) || table.length === 0) return 0;
  const rows: StandingRow[] = table.map((e: any) => ({
    rank: e.rank,
    team: teamKo(e.team?.name),
    played: e.all?.played ?? null,
    win: e.all?.win ?? null,
    draw: e.all?.draw ?? null,
    loss: e.all?.lose ?? null,
    points: e.points ?? null,
    note: e.goalsDiff != null ? (e.goalsDiff > 0 ? `+${e.goalsDiff}` : `${e.goalsDiff}`) : null,
  }));
  return replaceStandings("epl", rows);
}

// 관리자 붙여넣기 파싱. 형식: "순위,팀,경기,승,패,무[,비고]" 또는 "순위,팀,경기,승,무,패[,비고]"
// drawBeforeLoss=true 면 4번째 이후가 승,무,패 (축구식). false면 승,패,무 (야구식).
export function parseStandings(text: string, drawBeforeLoss: boolean): StandingRow[] {
  const out: StandingRow[] = [];
  const lines = (text || "").split("\n").map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    const c = line.split(",").map(s => s.trim());
    if (c.length < 2) continue;
    const num = (v?: string) => (v != null && v !== "" && !isNaN(Number(v)) ? Number(v) : null);
    const rank = num(c[0]); const team = c[1];
    if (rank == null || !team) continue;
    const played = num(c[2]);
    const win = num(c[3]);
    const a = num(c[4]); const b = num(c[5]); // a,b = (무,패) 또는 (패,무)
    const draw = drawBeforeLoss ? a : b;
    const loss = drawBeforeLoss ? b : a;
    const note = c[6] || null;
    out.push({ rank, team, played, win, draw, loss, points: null, note });
  }
  return out.sort((x, y) => x.rank - y.rank);
}
