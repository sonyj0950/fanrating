"use client";
import type { Player } from "./types";
import { teamColor, ringShadow, DEFAULT_HOME, DEFAULT_AWAY } from "@/lib/teamColors";
import { scoreChipStyle } from "@/lib/scoreColor";

type SubInfo = Record<string, { dir: "in" | "out"; min: number }>;
type SubKind = Record<string, string>; // playerId → 교체 종류(투수교체/대타/대주자/수비교체)

// 수비 위치 → 필드 좌표(%). 홈플레이트(포수)가 하단 중앙. (정규 야구장 도면 기준)
const POS_COORDS: Record<string, { left: number; top: number }> = {
  투수: { left: 50, top: 60 },
  포수: { left: 50, top: 88 },
  "1루수": { left: 66, top: 61 },
  "2루수": { left: 62, top: 44 },
  "3루수": { left: 34, top: 61 },
  유격수: { left: 38, top: 44 },
  좌익수: { left: 30, top: 34 },
  중견수: { left: 50, top: 25 },
  우익수: { left: 70, top: 34 },
};

// 마커/칩에 붙일 짧은 포지션 라벨
const POS_SHORT: Record<string, string> = {
  투수: "선발", 포수: "포", "1루수": "1", "2루수": "2", "3루수": "3",
  유격수: "유", 좌익수: "좌", 중견수: "중", 우익수: "우", 지명타자: "지",
};

function SubBadge({ s }: { s?: { dir: "in" | "out"; min: number } }) {
  if (!s) return null;
  return (
    <span className={`absolute -top-1.5 -left-2 h-[15px] px-1 rounded-md flex items-center
      text-[8px] font-extrabold text-white shadow z-20 whitespace-nowrap
      ${s.dir === "in" ? "bg-[#3c7d46]" : "bg-live"}`}>
      {s.dir === "in" ? "→" : "←"}{s.min}{s.min ? "회" : ""}
    </span>
  );
}

// 필드 위 선수 마커 (평점 원 + 이름)
function FieldMarker({ p, left, top, color, highlight, onPick, sub }:
  { p: Player; left: number; top: number; color: string; highlight?: boolean;
    onPick: (p: Player) => void; sub?: { dir: "in" | "out"; min: number } }) {
  const rated = p.avg !== null;
  const posShort = POS_SHORT[p.role] ?? "";
  return (
    <button onClick={(e) => { e.stopPropagation(); onPick(p); }} title={p.name}
      style={{ left: `${left}%`, top: `${top}%` }}
      className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 group focus:outline-none z-10 hover:z-20">
      <span className="relative">
        {/* 흰 분리 링 + 구단색 링 — 색 칩이 잔디와 겹치지 않게 */}
        <span style={{ boxShadow: `0 0 0 2px #fffdf8, 0 0 0 4.5px ${color}, 0 1px 5px rgba(0,0,0,.35)`,
            ...(rated ? scoreChipStyle(p.avg as number) : {}) }}
          className={`min-w-[34px] h-[34px] sm:min-w-[38px] sm:h-[38px] px-0.5 rounded-full
          ${highlight ? "outline outline-2 outline-gold outline-offset-1" : ""}
          flex items-center justify-center text-[13px] sm:text-[14px] font-extrabold tabular-nums
          ${rated ? "" : "bg-card text-wfaint"}
          group-hover:scale-110 transition`}>
          {rated ? p.avg : "–"}
        </span>
        <SubBadge s={sub} />
      </span>
      <span className="text-[9px] sm:text-[11px] leading-tight font-bold text-white drop-shadow
        whitespace-nowrap bg-black/[0.58] rounded-md px-1 py-0.5">
        {posShort && <span className="text-[#f5d878]">{posShort} </span>}{p.name}
      </span>
    </button>
  );
}

// 옆/아래 칩(교체투수·후보)
function Chip({ p, color, sub, kind, onPick }:
  { p: Player; color: string; sub?: { dir: "in" | "out"; min: number }; kind?: string; onPick: (p: Player) => void }) {
  const rated = p.avg !== null;
  return (
    <button onClick={() => onPick(p)} title={`${p.name} 평점 매기기`}
      className="relative flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full border border-wline bg-paper
        hover:bg-white hover:border-wsub active:scale-95 transition group">
      <SubBadge s={sub} />
      <span style={{ boxShadow: ringShadow(color), ...(rated ? scoreChipStyle(p.avg as number) : {}) }}
        className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-extrabold tabular-nums
        ${rated ? "" : "bg-card text-wmute"}
        group-hover:scale-105 transition`}>
        {rated ? p.avg : "–"}
      </span>
      <span className="text-[13px] font-medium text-ink whitespace-nowrap">
        {p.name}{kind ? <span className="text-wfaint ml-1">{kind}</span> : null}
      </span>
    </button>
  );
}

// 야구 수비 필드 뷰: 선발투수+8명 수비를 다이아몬드에 배치,
// 교체투수(불펜)는 옆, 후보(대타·대주자·수비교체)는 아래, 지명타자는 타석 옆 칩.
export default function BaseballField({ players, onPick, isHome = true, teamLabel,
  subInfo = {}, subKind = {}, highlightId, teamColors = {} }:
  { players: Player[]; onPick: (p: Player) => void; isHome?: boolean; teamLabel?: string;
    subInfo?: SubInfo; subKind?: SubKind; highlightId?: string | null; teamColors?: Record<string, string> }) {
  if (players.length === 0)
    return <p className="text-sm text-gray-400 bg-white border rounded p-4">등록된 선수가 없습니다.</p>;

  // 구단색 (오버라이드 > 공식색 > 홈/원정 기본)
  const color = teamColor(teamLabel, teamColors, isHome ? DEFAULT_HOME : DEFAULT_AWAY);

  // 타순 정보가 전혀 없으면(옛 방식 등록) 기존 2열 그리드로 표시
  const hasOrder = players.some(p => p.battingOrder != null);
  if (!hasOrder) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {players.map(p => (
          <button key={p.mpId} onClick={() => onPick(p)}
            className="w-full bg-card border border-wline rounded-lg p-2.5 text-left hover:border-ink hover:shadow-sm transition flex items-center gap-2">
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-1">
                <span className="font-semibold text-sm truncate">{p.name}</span>
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full shrink-0 tabular-nums ${p.avg !== null ? "" : "bg-wgray text-wfaint"}`}
                  style={p.avg !== null ? scoreChipStyle(p.avg as number) : undefined}>
                  {p.avg !== null ? p.avg : "－"}
                </span>
              </span>
              <span className="block text-xs text-wsub mt-0.5 truncate">
                {p.role || "－"}{p.count > 0 ? ` · ${p.count}명` : ""}
              </span>
            </span>
          </button>
        ))}
      </div>
    );
  }

  // 분류
  const starter = players.find(p => p.battingOrder == null && p.role === "투수");
  const dh = players.find(p => p.role === "지명타자");
  // 필드에 세울 수비수: 타순이 있고 수비 좌표가 있는 포지션
  const placed: { p: Player; left: number; top: number }[] = [];
  if (starter) placed.push({ p: starter, ...POS_COORDS["투수"] });
  for (const p of players) {
    if (p === starter || p === dh) continue;
    if (p.battingOrder != null && POS_COORDS[p.role]) {
      placed.push({ p, ...POS_COORDS[p.role] });
    }
  }
  const placedIds = new Set(placed.map(x => x.p.mpId));

  // 남은 선수 = 후보/교체. 투수교체이거나 투수면 불펜으로, 나머지는 후보로.
  const rest = players.filter(p => !placedIds.has(p.mpId) && p !== dh);
  const isReliever = (p: Player) => subKind[p.playerId] === "투수교체" || p.isPitcher === true;
  const bullpen = rest.filter(isReliever).sort((a, b) =>
    (subInfo[a.playerId]?.min ?? 99) - (subInfo[b.playerId]?.min ?? 99));
  const bench = rest.filter(p => !isReliever(p));

  return (
    <div>
      {/* 야구장 (아이콘 도면: 넓은 펜타곤 + 워닝트랙 테두리 + 체커 잔디 + 부채꼴 흙 내야) */}
      <div className="relative w-full max-w-[560px] mx-auto" style={{ aspectRatio: "320 / 292" }}>
          <svg viewBox="0 0 320 292" preserveAspectRatio="xMidYMid meet"
            className="absolute inset-0 w-full h-full pointer-events-none drop-shadow">
            <defs>
              <clipPath id="kbo-fld"><path d="M160 272 L18 152 Q160 -108 302 152 Z" /></clipPath>
              <pattern id="kbo-grass" width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="26" height="26" fill="#62885a" />
                <rect width="13" height="13" fill="#6b9161" />
                <rect x="13" y="13" width="13" height="13" fill="#6b9161" />
              </pattern>
            </defs>
            {/* 워닝트랙(흙) 테두리 + 체커 잔디 (웜톤) */}
            <path d="M160 272 L18 152 Q160 -108 302 152 Z" fill="#62885a" stroke="#d9b98a" strokeWidth="14" strokeLinejoin="round" />
            <g clipPath="url(#kbo-fld)"><rect x="0" y="0" width="320" height="292" fill="url(#kbo-grass)" /></g>
            {/* 파울라인 */}
            <line x1="160" y1="264" x2="32" y2="158" stroke="#fbfaf4" strokeWidth="2.6" strokeLinecap="round" />
            <line x1="160" y1="264" x2="288" y2="158" stroke="#fbfaf4" strokeWidth="2.6" strokeLinecap="round" />
            {/* 내야 흙 부채꼴 */}
            <path d="M160 256 L64 176 Q160 88 256 176 Z" fill="#c8a877" />
            {/* 내야 잔디 다이아몬드 */}
            <path d="M160 224 L214 174 L160 124 L106 174 Z" fill="#6f9563" />
            {/* 베이스 (2·1·3루) */}
            <rect x="156" y="120" width="8" height="8" rx="1.5" transform="rotate(45 160 124)" fill="#fbfaf4" />
            <rect x="210" y="170" width="8" height="8" rx="1.5" transform="rotate(45 214 174)" fill="#fbfaf4" />
            <rect x="102" y="170" width="8" height="8" rx="1.5" transform="rotate(45 106 174)" fill="#fbfaf4" />
            {/* 흙 마운드(투수) */}
            <circle cx="160" cy="175" r="17" fill="#a97b4f" />
            {/* 흙 홈써클(포수) + 홈플레이트 + 타석 */}
            <circle cx="160" cy="258" r="18" fill="#a97b4f" />
            <rect x="156" y="252" width="8" height="8" transform="rotate(45 160 256)" fill="#fbfaf4" />
            <rect x="139" y="248" width="8" height="18" rx="1" fill="none" stroke="#fbfaf4" strokeWidth="1.6" />
            <rect x="173" y="248" width="8" height="18" rx="1" fill="none" stroke="#fbfaf4" strokeWidth="1.6" />
          </svg>

          {teamLabel && (
            <span className="absolute top-[5%] left-1/2 -translate-x-1/2 text-[11px] text-white/95 font-semibold whitespace-nowrap z-10">
              {teamLabel} 수비
            </span>
          )}

          {/* 수비수 마커 */}
          {placed.map(({ p, left, top }) => (
            <FieldMarker key={p.mpId} p={p} left={left} top={top} color={color}
              highlight={p.playerId === highlightId} onPick={onPick} sub={subInfo[p.playerId]} />
          ))}

          {/* 지명타자: 타석(홈플레이트) 옆 별도 칩 */}
          {dh && (
            <button onClick={(e) => { e.stopPropagation(); onPick(dh); }} title={dh.name}
              className="absolute left-[84%] top-[88%] -translate-x-1/2 -translate-y-1/2 z-10
                flex items-center gap-1 bg-card/95 rounded-full pl-0.5 pr-1.5 py-0.5 shadow-md border border-wline">
              <span style={{ boxShadow: ringShadow(color), ...(dh.avg !== null ? scoreChipStyle(dh.avg as number) : {}) }}
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-extrabold tabular-nums
                ${dh.avg !== null ? "" : "bg-card text-wmute"}`}>
                {dh.avg !== null ? dh.avg : "–"}
              </span>
              <span className="text-[10px] font-bold text-ink whitespace-nowrap">지명 {dh.name}</span>
            </button>
          )}
        </div>

      {/* 하단: 후보(좌) + 교체투수 불펜(우하단) */}
      {(bench.length > 0 || bullpen.length > 0) && (
        <div className="mt-3 flex gap-2.5 items-start flex-wrap">
          {/* 후보 · 교체 (대타·대주자·수비교체) */}
          {bench.length > 0 && (
            <div className="flex-1 min-w-[240px] border border-wline rounded-xl p-2.5 bg-card">
              <p className="text-xs font-bold text-wsub mb-2">
                후보 · 교체 <span className="font-normal text-wfaint">— 탭하면 평점 매기기</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {bench.map(p => (
                  <Chip key={p.mpId} p={p} color={color} sub={subInfo[p.playerId]}
                    kind={subKind[p.playerId]} onPick={onPick} />
                ))}
              </div>
            </div>
          )}

          {/* 교체투수(불펜) — 우하단 */}
          {bullpen.length > 0 && (
            <div className="w-full sm:w-[210px] border border-wline rounded-xl p-2.5 bg-card">
              <p className="text-xs font-bold text-wsub mb-2">
                교체투수 <span className="font-normal text-wfaint">(불펜)</span>
              </p>
              <div className="flex flex-col gap-1.5">
                {bullpen.map(p => {
                  const s = subInfo[p.playerId];
                  return (
                    <button key={p.mpId} onClick={() => onPick(p)} title={`${p.name} 평점 매기기`}
                      className="flex items-center gap-2 bg-paper border border-wline rounded-lg px-2.5 py-1.5
                        hover:border-ink hover:shadow-sm transition">
                      <span className="text-[13px] font-semibold text-ink truncate flex-1 text-left">{p.name}</span>
                      {s && <span className="text-[10px] font-bold text-golddim bg-goldbg rounded px-1 py-0.5 shrink-0 tabular-nums">{s.min}회</span>}
                      <span className={`min-w-[30px] h-[24px] px-1 rounded-lg flex items-center justify-center text-[13px] font-extrabold tabular-nums shrink-0 ${p.avg !== null ? "" : "bg-wgray text-wfaint"}`}
                        style={p.avg !== null ? scoreChipStyle(p.avg as number) : undefined}>
                        {p.avg !== null ? p.avg : "–"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
