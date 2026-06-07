"use client";
import { useMemo } from "react";
import type { Player } from "./types";
import { POSITION_MAP, normalizeRole } from "@/lib/soccerPositions";

type Side = "home" | "away";

interface Placed {
  player: Player;
  left: number; // % (피치 기준)
  top: number;  // %
  accent: "core" | "wide";
}

// 한 팀 좌표(y: 0 자기골문 ~ 100 상대골문)를 피치 좌표(%)로 변환.
// 기본(전반 기준): home = 아래쪽 절반, away = 위쪽 절반(좌우/상하 반전).
function toPitch(x: number, y: number, side: Side): { left: number; top: number } {
  if (side === "home") {
    return { left: x, top: 98 - y * 0.46 };       // y0→98(하단), y100→52(중앙 부근)
  }
  return { left: 100 - x, top: 2 + y * 0.46 };     // 반전: y0→2(상단), y100→48
}

function place(players: Player[], side: Side): { placed: Placed[]; bench: Player[] } {
  const bench: Player[] = [];
  // 같은 포지션 코드를 가진 선수들을 모아서 가로로 살짝 분산
  const groups: Record<string, Player[]> = {};
  for (const p of players) {
    const code = normalizeRole(p.role);
    if (!code || !POSITION_MAP[code]) { bench.push(p); continue; }
    (groups[code] ||= []).push(p);
  }

  const placed: Placed[] = [];
  for (const code of Object.keys(groups)) {
    const def = POSITION_MAP[code];
    const list = groups[code];
    const n = list.length;
    list.forEach((player, i) => {
      // 다중 인원이면 ±8% 범위에서 분산
      const spread = n > 1 ? (i - (n - 1) / 2) * 8 : 0;
      const baseX = Math.min(94, Math.max(6, def.x + spread));
      const { left, top } = toPitch(baseX, def.y, side);
      placed.push({ player, left, top, accent: def.accent });
    });
  }
  return { placed, bench };
}

function Marker({ p, onPick }: { p: Placed; onPick: (pl: Player) => void }) {
  const { player } = p;
  const ring = p.accent === "core" ? "ring-red-500" : "ring-blue-500";
  const rated = player.avg !== null;
  return (
    <button
      onClick={() => onPick(player)}
      style={{ left: `${p.left}%`, top: `${p.top}%` }}
      className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 group focus:outline-none"
    >
      <span
        className={`min-w-[34px] h-[34px] px-1 rounded-full bg-white shadow-md ring-2 ${ring}
          flex items-center justify-center text-[11px] font-bold
          ${rated ? "text-gray-900" : "text-gray-400"} group-hover:scale-110 transition`}
      >
        {rated ? player.avg : "–"}
      </span>
      <span className="text-[10px] leading-none font-medium text-white drop-shadow max-w-[64px] truncate bg-black/35 rounded px-1 py-0.5">
        {player.name}
      </span>
    </button>
  );
}

// 감독/코치/심판 칩
function StaffChip({ p, onPick }: { p: Player; onPick: (pl: Player) => void }) {
  return (
    <button onClick={() => onPick(p)}
      className="w-full bg-white border rounded-lg px-2 py-1.5 text-left hover:border-blue-400 hover:shadow-sm transition">
      <div className="text-[10px] text-gray-500 leading-none mb-0.5">{p.role || "스태프"}</div>
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs font-semibold truncate">{p.name}</span>
        <span className={`text-[10px] font-bold shrink-0 ${p.avg !== null ? "text-blue-700" : "text-gray-300"}`}>
          {p.avg !== null ? `⭐${p.avg}` : "－"}
        </span>
      </div>
    </button>
  );
}

export default function SoccerField({
  home, away, homeStaff = [], awayStaff = [], officials = [],
  homeTeam, awayTeam, flip = false, onPick,
}: {
  home: Player[]; away: Player[];
  homeStaff?: Player[]; awayStaff?: Player[]; officials?: Player[];
  homeTeam?: string; awayTeam?: string;
  flip?: boolean; // 후반: 전반과 반대 진영 (총평은 전반 기준 유지)
  onPick: (p: Player) => void;
}) {
  // flip이면 두 팀의 진영(상/하)을 서로 맞바꾼다
  const homeP = useMemo(() => place(home, flip ? "away" : "home"), [home, flip]);
  const awayP = useMemo(() => place(away, flip ? "home" : "away"), [away, flip]);

  const topLabel = flip ? `▲ 홈 ${homeTeam ?? ""}` : `▲ 원정 ${awayTeam ?? ""}`;
  const bottomLabel = flip ? `▼ 원정 ${awayTeam ?? ""}` : `▼ 홈 ${homeTeam ?? ""}`;
  // 스태프 거터: 진영과 함께 좌/우도 맞바꿈
  const leftStaff = flip ? awayStaff : homeStaff;
  const rightStaff = flip ? homeStaff : awayStaff;
  const leftLabel = flip ? "원정 스태프" : "홈 스태프";
  const rightLabel = flip ? "홈 스태프" : "원정 스태프";

  const hasStaff = homeStaff.length > 0 || awayStaff.length > 0;

  return (
    <div>
      <div className="flex gap-2 justify-center items-stretch">
        {/* 좌측 스태프 (감독/코치) */}
        {hasStaff && (
          <div className="w-24 shrink-0 flex flex-col gap-1.5 justify-end pb-2">
            <p className="text-[10px] text-gray-400 text-center">{leftLabel}</p>
            {leftStaff.map(p => <StaffChip key={p.mpId} p={p} onPick={onPick}/>)}
          </div>
        )}

        {/* 피치 */}
        <div
          className="relative w-full max-w-md rounded-xl overflow-hidden shadow-lg
            bg-gradient-to-b from-green-600 via-green-500 to-green-600
            border-2 border-white/30"
          style={{ aspectRatio: "2 / 3" }}
        >
          {/* 잔디 줄무늬 */}
          <div className="absolute inset-0 opacity-20 pointer-events-none"
            style={{ backgroundImage: "repeating-linear-gradient(0deg, #fff 0 8%, transparent 8% 16%)" }} />

          {/* 필드 라인 */}
          <div className="absolute inset-2 border-2 border-white/70 rounded-sm pointer-events-none" />
          <div className="absolute left-2 right-2 top-1/2 h-0.5 -translate-y-1/2 bg-white/70 pointer-events-none" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[26%] aspect-square rounded-full border-2 border-white/70 pointer-events-none" />
          <div className="absolute left-1/2 -translate-x-1/2 top-2 w-[55%] h-[16%] border-2 border-t-0 border-white/70 pointer-events-none" />
          <div className="absolute left-1/2 -translate-x-1/2 bottom-2 w-[55%] h-[16%] border-2 border-b-0 border-white/70 pointer-events-none" />

          {/* 팀 표시 */}
          <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] text-white/80 font-semibold whitespace-nowrap">{topLabel}</span>
          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-white/80 font-semibold whitespace-nowrap">{bottomLabel}</span>

          {/* 선수 마커 */}
          {awayP.placed.map(p => <Marker key={p.player.mpId} p={p} onPick={onPick} />)}
          {homeP.placed.map(p => <Marker key={p.player.mpId} p={p} onPick={onPick} />)}
        </div>

        {/* 우측 스태프 (감독/코치) */}
        {hasStaff && (
          <div className="w-24 shrink-0 flex flex-col gap-1.5 justify-start pt-2">
            <p className="text-[10px] text-gray-400 text-center">{rightLabel}</p>
            {rightStaff.map(p => <StaffChip key={p.mpId} p={p} onPick={onPick}/>)}
          </div>
        )}
      </div>

      {/* 심판 */}
      {officials.length > 0 && (
        <div className="flex justify-center gap-1.5 mt-2 flex-wrap">
          {officials.map(p => (
            <button key={p.mpId} onClick={() => onPick(p)}
              className="text-xs px-2.5 py-1 rounded-full border bg-gray-800 text-white hover:bg-gray-700">
              🟨 {p.role || "심판"} {p.name}{p.avg !== null ? ` · ⭐${p.avg}` : ""}
            </button>
          ))}
        </div>
      )}

      {/* 범례 */}
      <div className="flex justify-center gap-4 mt-2 text-xs text-gray-500">
        <span className="flex items-center gap-1"><i className="w-3 h-3 rounded-full bg-white ring-2 ring-red-500 inline-block" /> 중앙 라인</span>
        <span className="flex items-center gap-1"><i className="w-3 h-3 rounded-full bg-white ring-2 ring-blue-500 inline-block" /> 윙·하프</span>
      </div>

      {/* 후보/교체 (포지션 코드가 없는 선수) */}
      {(homeP.bench.length > 0 || awayP.bench.length > 0) && (
        <div className="mt-3 border rounded p-2 bg-gray-50">
          <p className="text-xs font-semibold text-gray-500 mb-1">후보/교체</p>
          <div className="flex flex-wrap gap-1">
            {[...homeP.bench, ...awayP.bench].map(p => (
              <button key={p.mpId} onClick={() => onPick(p)}
                className="text-xs px-2 py-1 rounded-full border bg-white hover:bg-gray-100">
                {p.name}{p.avg !== null ? ` · ${p.avg}` : ""}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
