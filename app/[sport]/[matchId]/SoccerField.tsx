"use client";
import { useMemo, useRef } from "react";
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
    return { left: x, top: 99 - y * 0.49 };       // y0→99(하단), y100→50(중앙)
  }
  return { left: 100 - x, top: 1 + y * 0.49 };     // 반전: y0→1(상단), y100→50
}

function place(players: Player[], side: Side, flipped: boolean): { placed: Placed[]; bench: Player[] } {
  const bench: Player[] = [];
  const auto: Player[] = [];
  const placed: Placed[] = [];

  // 커스텀 위치가 있으면 그대로 사용 (flip 시 상하/좌우 반전)
  for (const p of players) {
    if (p.posX != null && p.posY != null) {
      const left = flipped ? 100 - p.posX : p.posX;
      const top = flipped ? 100 - p.posY : p.posY;
      placed.push({ player: p, left, top, accent: "core" });
    } else {
      const code = normalizeRole(p.role);
      if (!code || !POSITION_MAP[code]) { bench.push(p); continue; }
      auto.push(p);
    }
  }

  // 나머지는 포지션 코드 기준 자동 배치
  const groups: Record<string, Player[]> = {};
  for (const p of auto) {
    const code = normalizeRole(p.role)!;
    (groups[code] ||= []).push(p);
  }
  for (const code of Object.keys(groups)) {
    const def = POSITION_MAP[code];
    const list = groups[code];
    const n = list.length;
    list.forEach((player, i) => {
      const spread = n > 1 ? (i - (n - 1) / 2) * 8 : 0;
      const baseX = Math.min(94, Math.max(6, def.x + spread));
      const { left, top } = toPitch(baseX, def.y, side);
      placed.push({ player, left, top, accent: def.accent });
    });
  }
  return { placed, bench };
}

function Marker({ p, homeTeam, onPick, editMode, onDragEnd }:
  { p: Placed; homeTeam?: string; onPick: (pl: Player) => void;
    editMode?: boolean; onDragEnd?: (mpId: string, clientX: number, clientY: number) => void }) {
  const { player } = p;
  // 팀별 테두리 색 통일 (홈=파랑, 원정=빨강)
  const ring = player.team === homeTeam ? "ring-blue-500" : "ring-red-500";
  const rated = player.avg !== null;

  // 편집 모드: 포인터 드래그 (놓으면 좌표 저장 후 재렌더로 스냅)
  function onPointerDown(e: React.PointerEvent) {
    if (!editMode || !onDragEnd) return;
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    const startX = e.clientX, startY = e.clientY;
    target.setPointerCapture(e.pointerId);
    let moved = false;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
      // 손가락을 따라가는 임시 미리보기 (translate에 더해줌)
      target.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px)`;
      target.style.opacity = "0.8";
    };
    const up = (ev: PointerEvent) => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.style.transform = "";
      target.style.opacity = "";
      if (moved) onDragEnd!(player.mpId, ev.clientX, ev.clientY);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
  }

  return (
    <button
      onClick={() => { if (!editMode) onPick(player); }}
      onPointerDown={onPointerDown}
      style={{ left: `${p.left}%`, top: `${p.top}%`, touchAction: editMode ? "none" : undefined }}
      className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 group focus:outline-none z-10 hover:z-20
        ${editMode ? "cursor-move ring-2 ring-amber-400 rounded-full" : ""}`}
    >
      <span
        className={`min-w-[38px] h-[38px] px-1 rounded-full bg-white shadow-md ring-2 ${ring}
          flex items-center justify-center text-[14px] font-extrabold
          ${rated ? "text-gray-900" : "text-gray-400"} ${editMode ? "" : "group-hover:scale-110"} transition`}
      >
        {rated ? player.avg : "–"}
      </span>
      <span className="text-[11px] leading-tight font-bold text-white drop-shadow whitespace-nowrap bg-black/65 rounded px-1.5 py-0.5">
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
  homeTeam, awayTeam, flip = false, onPick, editMode = false, onMove,
}: {
  home: Player[]; away: Player[];
  homeStaff?: Player[]; awayStaff?: Player[]; officials?: Player[];
  homeTeam?: string; awayTeam?: string;
  flip?: boolean; // 후반: 전반과 반대 진영 (총평은 전반 기준 유지)
  onPick: (p: Player) => void;
  editMode?: boolean;                          // 관리자 위치 편집 모드
  onMove?: (mpId: string, x: number, y: number) => void; // 드래그 종료 시 좌표(%) 저장
}) {
  const pitchRef = useRef<HTMLDivElement>(null);
  // flip이면 두 팀의 진영(상/하)을 서로 맞바꾼다
  const homeP = useMemo(() => place(home, flip ? "away" : "home", flip), [home, flip]);
  const awayP = useMemo(() => place(away, flip ? "home" : "away", flip), [away, flip]);

  const topLabel = flip ? `▲ 홈 ${homeTeam ?? ""}` : `▲ 원정 ${awayTeam ?? ""}`;
  const bottomLabel = flip ? `▼ 원정 ${awayTeam ?? ""}` : `▼ 홈 ${homeTeam ?? ""}`;
  // 스태프 거터: 진영과 함께 좌/우도 맞바꿈
  const leftStaff = flip ? awayStaff : homeStaff;
  const rightStaff = flip ? homeStaff : awayStaff;
  const leftLabel = flip ? "원정 스태프" : "홈 스태프";
  const rightLabel = flip ? "홈 스태프" : "원정 스태프";

  const hasStaff = homeStaff.length > 0 || awayStaff.length > 0;

  // 드래그: 포인터 위치를 피치 기준 %로 변환해 onMove 호출 (flip 시 역변환해 저장)
  function handleDragEnd(mpId: string, clientX: number, clientY: number) {
    const el = pitchRef.current;
    if (!el || !onMove) return;
    const r = el.getBoundingClientRect();
    let x = ((clientX - r.left) / r.width) * 100;
    let y = ((clientY - r.top) / r.height) * 100;
    x = Math.max(2, Math.min(98, x));
    y = Math.max(2, Math.min(98, y));
    // 저장은 항상 비-flip(기본) 기준으로: flip 화면이면 되돌려 저장
    if (flip) { x = 100 - x; y = 100 - y; }
    onMove(mpId, Number(x.toFixed(1)), Number(y.toFixed(1)));
  }

  return (
    <div>
      {editMode && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mb-2 text-center">
          ✋ 편집 모드 — 선수를 끌어서 위치를 옮기세요. 위치는 자동 저장됩니다.
        </p>
      )}
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
          ref={pitchRef}
          className="relative w-full max-w-md rounded-xl overflow-hidden shadow-lg
            bg-gradient-to-b from-green-600 via-green-500 to-green-600
            border-2 border-white/30"
          style={{ aspectRatio: "2 / 3.5" }}
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
          {awayP.placed.map(p => <Marker key={p.player.mpId} p={p} homeTeam={homeTeam} onPick={onPick} editMode={editMode} onDragEnd={handleDragEnd} />)}
          {homeP.placed.map(p => <Marker key={p.player.mpId} p={p} homeTeam={homeTeam} onPick={onPick} editMode={editMode} onDragEnd={handleDragEnd} />)}
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

      {/* 팀 색 범례 */}
      <div className="flex justify-center gap-4 mt-2 text-xs text-gray-500">
        <span className="flex items-center gap-1"><i className="w-3 h-3 rounded-full bg-white ring-2 ring-blue-500 inline-block" /> {homeTeam ?? "홈"}</span>
        <span className="flex items-center gap-1"><i className="w-3 h-3 rounded-full bg-white ring-2 ring-red-500 inline-block" /> {awayTeam ?? "원정"}</span>
      </div>

      {/* 후보/교체 (포지션 코드가 없는 선수) — 팀별 분리 */}
      {(homeP.bench.length > 0 || awayP.bench.length > 0) && (
        <div className="mt-3 border rounded p-2 bg-gray-50">
          <p className="text-xs font-semibold text-gray-500 mb-2">후보/교체</p>
          <div className="grid grid-cols-2 gap-3">
            <BenchColumn team={homeTeam ?? "홈"} list={homeP.bench} dot="bg-blue-500" onPick={onPick} />
            <BenchColumn team={awayTeam ?? "원정"} list={awayP.bench} dot="bg-red-500" onPick={onPick} />
          </div>
        </div>
      )}
    </div>
  );
}

function BenchColumn({ team, list, dot, onPick }:
  { team: string; list: Player[]; dot: string; onPick: (p: Player) => void }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-gray-500 mb-1 flex items-center gap-1">
        <span className={`w-2 h-2 rounded-full ${dot} inline-block`} />{team}
      </p>
      {list.length === 0 ? (
        <p className="text-[11px] text-gray-300">없음</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {list.map(p => (
            <button key={p.mpId} onClick={() => onPick(p)}
              className="text-xs px-2 py-1 rounded-full border bg-white hover:bg-gray-100">
              {p.name}{p.avg !== null ? ` · ${p.avg}` : ""}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
