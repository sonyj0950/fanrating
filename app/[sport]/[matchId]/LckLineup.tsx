"use client";
import type { Player } from "./types";

export const LANE_ORDER = ["TOP", "JGL", "MID", "ADC", "SPT"];
const LANE_LABEL: Record<string, string> = {
  TOP: "탑", JGL: "정글", MID: "미드", ADC: "원딜", SPT: "서폿",
};
const LANE_ALIAS: Record<string, string> = {
  "TOP": "TOP", "탑": "TOP",
  "JGL": "JGL", "JUNGLE": "JGL", "정글": "JGL",
  "MID": "MID", "미드": "MID",
  "ADC": "ADC", "BOT": "ADC", "원딜": "ADC", "바텀": "ADC",
  "SPT": "SPT", "SUP": "SPT", "SUPPORT": "SPT", "서폿": "SPT", "서포터": "SPT",
};

export function laneOf(p: Player): string {
  const key = (p.role || "").trim().toUpperCase().replace(/\s+/g, "");
  return LANE_ALIAS[key] || LANE_ALIAS[(p.role || "").trim()] || "ETC";
}

function sortByLane(players: Player[]): Player[] {
  return [...players].sort((a, b) => {
    const ia = LANE_ORDER.indexOf(laneOf(a));
    const ib = LANE_ORDER.indexOf(laneOf(b));
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

export type Highlight = { playerId: string; kind: "POG" | "POM" } | null;

// 세트 탭일 때만 해당 세트의 챔피언
function champOf(p: Player, seg?: string): string | undefined {
  if (!seg || !/^set[1-5]$/.test(seg)) return undefined;
  return p.champions?.[seg];
}
function hlOf(p: Player, highlight?: Highlight): "POG" | "POM" | null {
  return highlight && highlight.playerId === p.playerId ? highlight.kind : null;
}

function Row({ p, onPick, seg, highlight }:
  { p: Player; onPick: (pl: Player) => void; seg?: string; highlight?: Highlight }) {
  const lane = laneOf(p);
  const champ = champOf(p, seg);
  const hl = hlOf(p, highlight);
  return (
    <button onClick={() => onPick(p)}
      className={`w-full bg-white border rounded-lg p-2.5 flex items-center gap-2 hover:border-blue-400 hover:shadow-sm transition text-left ${
        hl ? "border-amber-400 ring-1 ring-amber-300" : ""}`}>
      <span className="text-[10px] font-bold w-9 text-center py-0.5 rounded bg-gray-800 text-white shrink-0">
        {lane === "ETC" ? (p.role || "?") : lane}
      </span>
      <span className="flex-1 min-w-0 flex items-center gap-1.5">
        <span className="font-semibold text-sm truncate">{p.name}</span>
        {champ && <span className="text-[11px] text-gray-400 truncate shrink-0">{champ}</span>}
        {hl && <span className="text-[9px] font-extrabold text-amber-700 bg-amber-100 rounded px-1 py-px shrink-0">👑 {hl}</span>}
      </span>
      <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full shrink-0
        ${p.avg !== null ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-400"}`}>
        {p.avg !== null ? `⭐ ${p.avg}` : "－"}
      </span>
    </button>
  );
}

export default function LckLineup({ home, away, homeTeam, awayTeam, onPick, seg, highlight }:
  { home: Player[]; away: Player[]; homeTeam: string; awayTeam: string;
    onPick: (p: Player) => void; seg?: string; highlight?: Highlight }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div>
        <h3 className="font-semibold mb-2">🔵 {homeTeam}</h3>
        <div className="space-y-1.5">{sortByLane(home).map(p => <Row key={p.mpId} p={p} onPick={onPick} seg={seg} highlight={highlight} />)}</div>
      </div>
      <div>
        <h3 className="font-semibold mb-2">🔴 {awayTeam}</h3>
        <div className="space-y-1.5">{sortByLane(away).map(p => <Row key={p.mpId} p={p} onPick={onPick} seg={seg} highlight={highlight} />)}</div>
      </div>
    </div>
  );
}

// 라인 대결 비교: TOP↔TOP, JGL↔JGL … 맞라인 평점 비교 + 👑
export function LckMatchup({ home, away, homeTeam, awayTeam, onPick, seg, highlight }:
  { home: Player[]; away: Player[]; homeTeam: string; awayTeam: string;
    onPick: (p: Player) => void; seg?: string; highlight?: Highlight }) {
  const byAvg = (a: Player, b: Player) => (b.avg ?? -1) - (a.avg ?? -1);

  // 한쪽 셀 (이름 + 챔피언 + 평점 배지)
  const Cell = ({ p, side, win }: { p?: Player; side: "home" | "away"; win: boolean }) => {
    const isHome = side === "home";
    const rated = p && p.avg !== null;
    const base = `flex-1 relative flex items-center gap-2 px-3 py-2.5 overflow-hidden ${isHome ? "justify-end" : "flex-row-reverse justify-end"}`;
    if (!p) return <div className={base}><span className="text-[13px] text-gray-300 italic">—</span></div>;
    const champ = champOf(p, seg);
    const hl = hlOf(p, highlight);
    return (
      <button onClick={() => onPick(p)} className={base}>
        {win && (
          <span className={`absolute inset-y-0 w-2/3 opacity-[0.13] ${isHome
            ? "right-0 bg-gradient-to-l from-amber-500 to-transparent"
            : "left-0 bg-gradient-to-r from-red-500 to-transparent"}`} />
        )}
        <span className={`relative z-10 flex flex-col min-w-0 ${isHome ? "items-end" : "items-start"}`}>
          <span className="flex items-center gap-1">
            {hl && <span className="text-[8px] font-extrabold text-amber-700 bg-amber-100 rounded px-1 shrink-0">👑{hl}</span>}
            <span className={`text-[13.5px] truncate max-w-[80px] ${
              win ? (isHome ? "font-extrabold text-gray-900" : "font-extrabold text-red-600") : "font-semibold text-gray-700"}`}>{p.name}</span>
          </span>
          {champ && <span className="text-[10px] text-gray-400 truncate max-w-[88px]">{champ}</span>}
        </span>
        <span className={`relative z-10 w-9 h-9 rounded-[11px] flex items-center justify-center text-[13px] font-extrabold shrink-0 ${
          win ? (isHome ? "bg-amber-500 text-white shadow-md shadow-amber-500/40" : "bg-red-500 text-white shadow-md shadow-red-500/40")
              : rated ? "bg-gray-100 text-gray-700" : "bg-gray-50 text-gray-300"}`}>
          {rated ? p.avg : "–"}
        </span>
      </button>
    );
  };

  // 각 라인 대표 1명 (평점 높은 순)
  const pick = (list: Player[], lane: string) => list.filter(p => laneOf(p) === lane).sort(byAvg)[0];
  const rows = LANE_ORDER.map(lane => ({ lane, h: pick(home, lane), a: pick(away, lane) }))
    .filter(r => r.h || r.a);
  if (rows.length === 0) return null;

  return (
    <div className="mt-5 bg-white border border-gray-200 rounded-2xl overflow-hidden">
      {/* 헤더: 양 팀 */}
      <div className="flex items-center bg-gray-900 text-white px-3.5 py-2.5">
        <div className="flex-1 flex items-center gap-1.5 text-[13px] font-extrabold">
          <span className="w-2 h-2 rounded-full bg-amber-500" />{homeTeam}
        </div>
        <span className="text-[10px] font-bold text-gray-400 px-2">라인 대결</span>
        <div className="flex-1 flex items-center justify-end gap-1.5 text-[13px] font-extrabold">
          {awayTeam}<span className="w-2 h-2 rounded-full bg-red-500" />
        </div>
      </div>

      {rows.map(({ lane, h, a }) => {
        const hv = h?.avg ?? null, av = a?.avg ?? null;
        const hWin = hv !== null && av !== null && hv > av;
        const aWin = hv !== null && av !== null && av > hv;
        const bothEmpty = hv === null && av === null;
        return (
          <div key={lane} className={`flex items-stretch border-t border-gray-50 min-h-[52px] ${bothEmpty ? "opacity-50" : ""}`}>
            <Cell p={h} side="home" win={hWin} />
            <div className="w-12 shrink-0 flex flex-col items-center justify-center border-x border-gray-100">
              <span className="text-[9px] font-extrabold text-gray-400">{LANE_LABEL[lane] ?? lane}</span>
              <span className="text-[13px] leading-none mt-0.5">{hWin || aWin ? "👑" : <span className="text-[8px] font-extrabold text-gray-300">VS</span>}</span>
            </div>
            <Cell p={a} side="away" win={aWin} />
          </div>
        );
      })}

      {/* 캡처용 푸터 */}
      <div className="flex items-center justify-center gap-2 bg-gray-900 text-white text-[12px] font-semibold py-2.5">
        <span>fanarena<span className="text-gray-400">.kr</span></span>
      </div>
    </div>
  );
}
