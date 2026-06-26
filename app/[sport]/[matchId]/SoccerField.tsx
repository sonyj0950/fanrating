"use client";
import { useMemo, useRef, useState } from "react";
import type { Player } from "./types";
import { POSITION_MAP, normalizeRole, nearestCode } from "@/lib/soccerPositions";
import { teamColor, ringShadow, DEFAULT_HOME, DEFAULT_AWAY } from "@/lib/teamColors";

type Side = "home" | "away";

// 피치 라벨용 짧은 이름:
//  - 6자 이하(짧은 한글 등): 풀네임 그대로
//  - 길면(주로 외국 이름 "이름 성"): 마지막 어절(성)만 — 말줄임 없음
//  - 전체 이름은 마커 탭/호버 시 따로 표시
function displayName(name: string): string {
  const n = name.trim();
  if (n.length <= 6) return n;
  const parts = n.split(/\s+/);
  if (parts.length >= 2) return parts[parts.length - 1]; // 마지막 어절(성)
  return n; // 공백 없는 긴 한 단어는 그대로 (탭하면 전체 보임)
}

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

function place(players: Player[], side: Side, flipped: boolean,
  subs: { minute: number; outPlayerId: string; inPlayerId: string }[] = []): { placed: Placed[]; bench: Player[] } {
  const bench: Player[] = [];
  const auto: Player[] = [];
  const placed: Placed[] = [];
  // 교체로 들어온 선수 → 나간 선수 매핑 (벌림 계산에서 제외하고 파트너 자리에 겹침)
  const inToOut = new Map<string, string>();
  for (const s of subs) inToOut.set(s.inPlayerId, s.outPlayerId);

  // 커스텀 위치가 있으면 그대로 사용 (flip 시 상하/좌우 반전)
  for (const p of players) {
    if (p.isDefault === false) { bench.push(p); continue; } // 후보/교체 → 벤치
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

  // 자동 배치 — 교체 인 선수는 일단 제외(파트너 자리에 겹쳐 둘 것이므로 벌림에 안 셈)
  const subIns: Player[] = [];
  const groups: Record<string, Player[]> = {};
  for (const p of auto) {
    if (inToOut.has(p.playerId)) { subIns.push(p); continue; }
    const code = normalizeRole(p.role)!;
    (groups[code] ||= []).push(p);
  }
  for (const code of Object.keys(groups)) {
    const def = POSITION_MAP[code];
    const list = groups[code];
    const n = list.length;
    list.forEach((player, i) => {
      const spread = n > 1 ? (i - (n - 1) / 2) * 11 : 0;
      const baseX = Math.min(94, Math.max(6, def.x + spread));
      const { left, top } = toPitch(baseX, def.y, side);
      placed.push({ player, left, top, accent: def.accent });
    });
  }
  // 교체 인 선수: 파트너(나간 선수) 자리에 겹쳐 배치 → 스택. 파트너 없으면 자기 코드 위치로.
  for (const p of subIns) {
    const partner = placed.find(pl => pl.player.playerId === inToOut.get(p.playerId));
    if (partner) {
      placed.push({ player: p, left: partner.left, top: partner.top, accent: "core" });
    } else {
      const code = normalizeRole(p.role);
      const def = code ? POSITION_MAP[code] : null;
      if (def) { const { left, top } = toPitch(def.x, def.y, side); placed.push({ player: p, left, top, accent: def.accent }); }
      else bench.push(p);
    }
  }
  return { placed, bench };
}

// 같은 자리(좌표 근접) 마커들을 묶어서 스택으로.
// 대표 선정: (1) 해당 구간에 실제로 뛴 선수 우선(전반=선발/아웃, 후반=교체 인)
//            (2) 평점 높은 순 (3) 선발 우선
interface Stack { id: string; left: number; top: number; members: Placed[]; }
function buildStacks(placed: Placed[], seg?: string,
  subInfo: Record<string, { dir: "in" | "out"; min: number }> = {}): Stack[] {
  const stacks: Stack[] = [];
  const TH = 6; // % 거리 임계값
  for (const p of placed) {
    const hit = stacks.find(s => Math.hypot(s.left - p.left, s.top - p.top) < TH);
    if (hit) hit.members.push(p);
    else stacks.push({ id: p.player.mpId, left: p.left, top: p.top, members: [p] });
  }
  // 구간별 "실제 출전" 우선순위 (낮을수록 대표에 가까움)
  const segRank = (pl: Player): number => {
    const s = subInfo[pl.playerId];
    if (seg === "second") {                 // 후반: 교체로 들어온 선수가 주전
      if (s?.dir === "in") return 0;
      if (s?.dir === "out") return 2;        // 후반에 빠진 선수는 뒤로
      return 1;
    }
    if (seg === "first") {                   // 전반: 선발(나중에 빠진 선수)이 주전
      if (s?.dir === "out") return 0;
      if (s?.dir === "in") return 2;         // 전반엔 안 뛴 교체 인 선수는 뒤로
      return 1;
    }
    return 1;                                // 총평/나의평점: 구간 우선 없음
  };
  for (const s of stacks) {
    s.members.sort((a, b) => {
      const ra = segRank(a.player), rb = segRank(b.player);
      if (ra !== rb) return ra - rb;                       // 구간 실제 출전 우선
      const av = a.player.avg ?? -1, bv = b.player.avg ?? -1;
      if (bv !== av) return bv - av;                       // 평점 높은 순
      if (a.player.isDefault !== b.player.isDefault) return a.player.isDefault ? -1 : 1; // 선발 우선
      return a.player.name.localeCompare(b.player.name);
    });
    s.id = s.members[0].player.mpId;                       // 대표 = 첫 멤버
  }
  return stacks;
}

function Marker({ p, homeTeam, onPick, editMode, onDragEnd, stackCount = 0, onStackClick, sub, teamColors = {} }:
  { p: Placed; homeTeam?: string; onPick: (pl: Player) => void;
    editMode?: boolean; onDragEnd?: (mpId: string, clientX: number, clientY: number) => void;
    stackCount?: number; onStackClick?: () => void; sub?: { dir: "in" | "out"; min: number };
    teamColors?: Record<string, string> }) {
  const { player } = p;
  // 팀별 테두리 색 (구단색 > 공식색 > 홈=파랑/원정=빨강)
  const color = teamColor(player.team, teamColors, player.team === homeTeam ? DEFAULT_HOME : DEFAULT_AWAY);
  const rated = player.avg !== null;
  const short = displayName(player.name);
  const isShortened = short !== player.name;

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
      onClick={(e) => {
        if (editMode) return;
        e.stopPropagation();
        if (stackCount > 0 && onStackClick) onStackClick();
        else onPick(player);
      }}
      onPointerDown={onPointerDown}
      title={player.name}
      style={{ left: `${p.left}%`, top: `${p.top}%`, touchAction: editMode ? "none" : undefined,
        transition: "left .3s ease, top .3s ease" }}
      className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 group focus:outline-none z-10 hover:z-20
        ${editMode ? "cursor-move ring-2 ring-amber-400 rounded-full" : ""}`}
    >
      <span className="relative">
      <span
        style={{ boxShadow: ringShadow(color) }}
        className={`min-w-[28px] h-[28px] sm:min-w-[38px] sm:h-[38px] px-0.5 rounded-full bg-white
          flex items-center justify-center text-[11px] sm:text-[14px] font-extrabold
          ${rated ? "text-gray-900" : "text-gray-400"} ${editMode ? "" : "group-hover:scale-110"} transition`}
      >
        {rated ? player.avg : "–"}
      </span>
        {/* 같은 자리 N명 더 (스택) */}
        {stackCount > 0 && (
          <span className="absolute -top-1 -right-1.5 min-w-[16px] h-[16px] px-0.5 rounded-full bg-gray-900 text-white
            text-[9px] sm:text-[10px] font-extrabold flex items-center justify-center shadow z-20">
            +{stackCount}
          </span>
        )}
        {/* 교체 배지 (→들어옴 / ←나감 + 분) */}
        {sub && (
          <span className={`absolute -top-1.5 -left-2.5 h-[15px] px-1 rounded-md flex items-center
            text-[8px] sm:text-[9px] font-extrabold text-white shadow z-20 whitespace-nowrap
            ${sub.dir === "in" ? "bg-green-600" : "bg-red-500"}`}>
            {sub.dir === "in" ? "→" : "←"}{sub.min}{"'"}
          </span>
        )}
      </span>
      <span className="relative text-[9px] sm:text-[11px] leading-tight font-bold text-white drop-shadow
        whitespace-nowrap bg-black/65 rounded px-1 py-0.5">
        {short}
        {/* 줄임된 이름은 호버 시 전체 이름 표시 (데스크톱) */}
        {isShortened && (
          <span className="hidden sm:group-hover:block absolute left-1/2 -translate-x-1/2 bottom-full mb-1
            whitespace-nowrap bg-black/90 text-white rounded px-1.5 py-0.5 text-[11px] z-30 pointer-events-none">
            {player.name}
          </span>
        )}
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
  subs = [], subInfo = {}, seg, teamColors = {},
}: {
  home: Player[]; away: Player[];
  homeStaff?: Player[]; awayStaff?: Player[]; officials?: Player[];
  homeTeam?: string; awayTeam?: string;
  flip?: boolean; // 후반: 전반과 반대 진영 (총평은 전반 기준 유지)
  onPick: (p: Player) => void;
  editMode?: boolean;                          // 관리자 위치 편집 모드
  onMove?: (mpId: string, x: number, y: number, role?: string) => void; // 드래그 종료 시 좌표(%)+포지션 저장
  subs?: { minute: number; outPlayerId: string; inPlayerId: string }[];
  subInfo?: Record<string, { dir: "in" | "out"; min: number }>;
  seg?: string; // 현재 탭 (full/first/second/mine) — 구간별 대표 선정용
  teamColors?: Record<string, string>;         // 구단색 오버라이드
}) {
  const pitchRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<string | null>(null); // 펼쳐진 스택 id (한 번에 하나)
  // flip이면 두 팀의 진영(상/하)을 서로 맞바꾼다
  const homeP = useMemo(() => place(home, flip ? "away" : "home", flip, subs), [home, flip, subs]);
  const awayP = useMemo(() => place(away, flip ? "home" : "away", flip, subs), [away, flip, subs]);
  // 교체 처리: OUT/IN을 같은 자리로 모음.
  //  - 둘 다 피치: IN을 OUT 자리로 이동
  //  - IN이 후보(벤치)면: 끌어와서 OUT 자리에 배치하고 벤치에서 제거 → 스택 형성
  function resolvePitch(placed: Placed[], bench: Player[]): { placed: Placed[]; bench: Player[] } {
    if (!subs.length) return { placed, bench };
    const np = placed.map(p => ({ ...p }));
    let nb = [...bench];
    for (const s of subs) {
      const out = np.find(p => p.player.playerId === s.outPlayerId);
      if (!out) continue;
      const inOnPitch = np.find(p => p.player.playerId === s.inPlayerId);
      if (inOnPitch) {
        inOnPitch.left = out.left; inOnPitch.top = out.top;
      } else {
        const idx = nb.findIndex(b => b.playerId === s.inPlayerId);
        if (idx >= 0) {
          const inP = nb[idx];
          nb.splice(idx, 1);
          np.push({ player: inP, left: out.left, top: out.top, accent: "core" });
        }
      }
    }
    return { placed: np, bench: nb };
  }
  const homeR = useMemo(() => resolvePitch(homeP.placed, homeP.bench), [homeP, subs]);
  const awayR = useMemo(() => resolvePitch(awayP.placed, awayP.bench), [awayP, subs]);
  const homeStacks = useMemo(() => buildStacks(homeR.placed, seg, subInfo), [homeR, seg, subInfo]);
  const awayStacks = useMemo(() => buildStacks(awayR.placed, seg, subInfo), [awayR, seg, subInfo]);

  const topLabel = flip ? `▲ 홈 ${homeTeam ?? ""}` : `▲ 원정 ${awayTeam ?? ""}`;
  const bottomLabel = flip ? `▼ 원정 ${awayTeam ?? ""}` : `▼ 홈 ${homeTeam ?? ""}`;
  // 스태프 거터: 진영과 함께 좌/우도 맞바꿈
  const leftStaff = flip ? awayStaff : homeStaff;
  const rightStaff = flip ? homeStaff : awayStaff;
  const leftLabel = flip ? "원정 스태프" : "홈 스태프";
  const rightLabel = flip ? "홈 스태프" : "원정 스태프";

  const hasStaff = homeStaff.length > 0 || awayStaff.length > 0;

  // 스택 렌더: 접힘=대표만(+N), 펼침=좌우 분산. 편집 모드는 스택 없이 개별 렌더.
  function renderStacks(stacks: Stack[]) {
    return stacks.map(s => {
      const isOpen = expanded === s.id;
      if (s.members.length === 1) {
        return <Marker key={s.id} p={s.members[0]} homeTeam={homeTeam} teamColors={teamColors} onPick={onPick}
          editMode={editMode} onDragEnd={handleDragEnd} sub={subInfo[s.members[0].player.playerId]} />;
      }
      if (!isOpen) {
        const rep = s.members[0];
        return <Marker key={s.id} p={rep} homeTeam={homeTeam} teamColors={teamColors} onPick={onPick}
          editMode={editMode} onDragEnd={handleDragEnd} sub={subInfo[rep.player.playerId]}
          stackCount={s.members.length - 1} onStackClick={() => setExpanded(s.id)} />;
      }
      const k = s.members.length;
      return s.members.map((m, i) => {
        const off = (i - (k - 1) / 2) * 15;
        const left = Math.max(7, Math.min(93, s.left + off));
        return <Marker key={m.player.mpId} p={{ ...m, left }} homeTeam={homeTeam} teamColors={teamColors}
          onPick={onPick} editMode={editMode} onDragEnd={handleDragEnd} sub={subInfo[m.player.playerId]} />;
      });
    });
  }

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
    // 드롭한 위치 → 팀 로컬 좌표로 변환 후 가장 가까운 포지션 코드 자동 산출
    const isHome = home.some(p => p.mpId === mpId);
    let tx: number, ty: number;
    if (isHome) { tx = x; ty = (99 - y) / 0.49; }
    else { tx = 100 - x; ty = (y - 1) / 0.49; }
    ty = Math.max(0, Math.min(100, ty));
    const role = nearestCode(tx, ty);
    onMove(mpId, Number(x.toFixed(1)), Number(y.toFixed(1)), role);
  }

  return (
    <div>
      {editMode && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mb-2 text-center">
          ✋ 편집 모드 — 선수를 끌어서 위치를 옮기세요. 위치는 자동 저장됩니다.
        </p>
      )}
      <div className="flex gap-2 justify-center items-stretch">
        {/* 좌측 스태프 (감독/코치) — 데스크톱만 */}
        {hasStaff && (
          <div className="hidden md:flex w-24 shrink-0 flex-col gap-1.5 justify-end pb-2">
            <p className="text-[10px] text-gray-400 text-center">{leftLabel}</p>
            {leftStaff.map(p => <StaffChip key={p.mpId} p={p} onPick={onPick}/>)}
          </div>
        )}

        {/* 피치 */}
        <div
          ref={pitchRef}
          onClick={() => { if (!editMode && expanded) setExpanded(null); }}
          className="relative w-full max-w-md rounded-xl overflow-hidden shadow-lg
            bg-gradient-to-b from-green-600 via-green-500 to-green-600
            border-2 border-white/30"
          style={{ aspectRatio: "2 / 3.8" }}
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

          {/* 선수 마커 (편집 모드는 개별 렌더로 드래그 유지) */}
          {editMode ? (
            <>
              {awayP.placed.map(p => <Marker key={p.player.mpId} p={p} homeTeam={homeTeam} teamColors={teamColors} onPick={onPick} editMode={editMode} onDragEnd={handleDragEnd} />)}
              {homeP.placed.map(p => <Marker key={p.player.mpId} p={p} homeTeam={homeTeam} teamColors={teamColors} onPick={onPick} editMode={editMode} onDragEnd={handleDragEnd} />)}
            </>
          ) : (
            <>
              {renderStacks(awayStacks)}
              {renderStacks(homeStacks)}
            </>
          )}
        </div>

        {/* 우측 스태프 (감독/코치) — 데스크톱만 */}
        {hasStaff && (
          <div className="hidden md:flex w-24 shrink-0 flex-col gap-1.5 justify-start pt-2">
            <p className="text-[10px] text-gray-400 text-center">{rightLabel}</p>
            {rightStaff.map(p => <StaffChip key={p.mpId} p={p} onPick={onPick}/>)}
          </div>
        )}
      </div>

      {/* 스태프 (감독/코치) — 모바일은 피치 아래 가로 배치 */}
      {hasStaff && (
        <div className="md:hidden mt-2 grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <p className="text-[10px] text-gray-400">{leftLabel}</p>
            {leftStaff.map(p => <StaffChip key={p.mpId} p={p} onPick={onPick}/>)}
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-gray-400">{rightLabel}</p>
            {rightStaff.map(p => <StaffChip key={p.mpId} p={p} onPick={onPick}/>)}
          </div>
        </div>
      )}

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
        <span className="flex items-center gap-1"><i className="w-3 h-3 rounded-full bg-white inline-block" style={{ boxShadow: ringShadow(teamColor(homeTeam, teamColors, DEFAULT_HOME)) }} /> {homeTeam ?? "홈"}</span>
        <span className="flex items-center gap-1"><i className="w-3 h-3 rounded-full bg-white inline-block" style={{ boxShadow: ringShadow(teamColor(awayTeam, teamColors, DEFAULT_AWAY)) }} /> {awayTeam ?? "원정"}</span>
      </div>

      {/* 후보/교체 (포지션 코드가 없는 선수) — 팀별 분리 */}
      {(homeR.bench.length > 0 || awayR.bench.length > 0) && (
        <div className="mt-3 border rounded p-2 bg-gray-50">
          <p className="text-xs font-semibold text-gray-500 mb-2">
            🔁 후보/교체 <span className="font-normal text-gray-400">— 탭하면 평점 매기기</span>
          </p>
          <div className="grid grid-cols-2 gap-3">
            <BenchColumn team={homeTeam ?? "홈"} list={homeR.bench} onPick={onPick} subInfo={subInfo}
              color={teamColor(homeTeam, teamColors, DEFAULT_HOME)} />
            <BenchColumn team={awayTeam ?? "원정"} list={awayR.bench} onPick={onPick} subInfo={subInfo}
              color={teamColor(awayTeam, teamColors, DEFAULT_AWAY)} />
          </div>
        </div>
      )}
    </div>
  );
}

function BenchColumn({ team, list, color, onPick, subInfo = {} }:
  { team: string; list: Player[]; color: string; onPick: (p: Player) => void;
    subInfo?: Record<string, { dir: "in" | "out"; min: number }> }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-gray-500 mb-1.5 flex items-center gap-1">
        <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />{team}
      </p>
      {list.length === 0 ? (
        <p className="text-[11px] text-gray-300">없음</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {list.map(p => {
            const rated = p.avg !== null;
            const s = subInfo[p.playerId];
            return (
              <button key={p.mpId} onClick={() => onPick(p)} title={`${p.name} 평점 매기기`}
                className="relative flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full border bg-white
                  hover:bg-gray-50 hover:border-gray-300 active:scale-95 transition group">
                {s && (
                  <span className={`absolute -top-1.5 -left-1 h-[14px] px-1 rounded-md flex items-center
                    text-[8px] font-extrabold text-white shadow whitespace-nowrap
                    ${s.dir === "in" ? "bg-green-600" : "bg-red-500"}`}>
                    {s.dir === "in" ? "→" : "←"}{s.min}{"'"}
                  </span>
                )}
                <span style={{ boxShadow: ringShadow(color) }}
                  className={`w-7 h-7 rounded-full bg-white flex items-center justify-center text-[12px] font-extrabold
                  ${rated ? "text-gray-900" : "text-gray-300"} group-hover:scale-105 transition`}>
                  {rated ? p.avg : "–"}
                </span>
                <span className="text-[13px] font-medium text-gray-800">{p.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
