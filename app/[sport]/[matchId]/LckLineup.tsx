"use client";
import type { Player } from "./types";

const LANE_ORDER = ["TOP", "JGL", "MID", "ADC", "SPT"];
const LANE_ALIAS: Record<string, string> = {
  "TOP": "TOP", "탑": "TOP",
  "JGL": "JGL", "JUNGLE": "JGL", "정글": "JGL",
  "MID": "MID", "미드": "MID",
  "ADC": "ADC", "BOT": "ADC", "원딜": "ADC", "바텀": "ADC",
  "SPT": "SPT", "SUP": "SPT", "SUPPORT": "SPT", "서폿": "SPT", "서포터": "SPT",
};

function laneOf(p: Player): string {
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

function Row({ p, onPick }: { p: Player; onPick: (pl: Player) => void }) {
  const lane = laneOf(p);
  return (
    <button onClick={() => onPick(p)}
      className="w-full bg-white border rounded-lg p-2.5 flex items-center gap-2 hover:border-blue-400 hover:shadow-sm transition text-left">
      <span className="text-[10px] font-bold w-9 text-center py-0.5 rounded bg-gray-800 text-white shrink-0">
        {lane === "ETC" ? (p.role || "?") : lane}
      </span>
      <span className="font-semibold text-sm flex-1 truncate">{p.name}</span>
      <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full shrink-0
        ${p.avg !== null ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-400"}`}>
        {p.avg !== null ? `⭐ ${p.avg}` : "－"}
      </span>
    </button>
  );
}

export default function LckLineup({ home, away, homeTeam, awayTeam, onPick }:
  { home: Player[]; away: Player[]; homeTeam: string; awayTeam: string; onPick: (p: Player) => void }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div>
        <h3 className="font-semibold mb-2">🔵 {homeTeam}</h3>
        <div className="space-y-1.5">{sortByLane(home).map(p => <Row key={p.mpId} p={p} onPick={onPick} />)}</div>
      </div>
      <div>
        <h3 className="font-semibold mb-2">🔴 {awayTeam}</h3>
        <div className="space-y-1.5">{sortByLane(away).map(p => <Row key={p.mpId} p={p} onPick={onPick} />)}</div>
      </div>
    </div>
  );
}
