"use client";
import type { Player } from "./types";

// 야구 라인업: 선발투수 → 타순 1~9 → 교체·벤치. (타순 데이터가 없는 옛 경기는 기존 카드 그리드)
export default function BaseballField({ players, onPick }:
  { players: Player[]; onPick: (p: Player) => void }) {
  if (players.length === 0)
    return <p className="text-sm text-gray-400 bg-white border rounded p-4">등록된 선수가 없습니다.</p>;

  const Card = ({ p, order }: { p: Player; order?: number }) => (
    <button onClick={() => onPick(p)}
      className="w-full bg-white border rounded-lg p-2.5 text-left hover:border-blue-400 hover:shadow-sm transition flex items-center gap-2">
      {order != null && (
        <span className="text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full bg-emerald-50 text-emerald-700 shrink-0">{order}</span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-1">
          <span className="font-semibold text-sm truncate">{p.name}</span>
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full shrink-0
            ${p.avg !== null ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-400"}`}>
            {p.avg !== null ? `⭐ ${p.avg}` : "－"}
          </span>
        </span>
        <span className="block text-xs text-gray-500 mt-0.5 truncate">
          {p.role || "－"}{p.count > 0 ? ` · ${p.count}명` : ""}
        </span>
      </span>
    </button>
  );

  // 타순 정보가 전혀 없으면(옛 방식 등록) 기존 2열 그리드로 표시
  const hasOrder = players.some(p => p.battingOrder != null);
  if (!hasOrder) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {players.map(p => <Card key={p.mpId} p={p} />)}
      </div>
    );
  }

  const pitchers = players.filter(p => p.battingOrder == null && (p.isPitcher || p.role === "투수"));
  const batters = players.filter(p => p.battingOrder != null)
    .sort((a, b) => (a.battingOrder as number) - (b.battingOrder as number));
  const used = new Set([...pitchers, ...batters].map(p => p.mpId));
  const bench = players.filter(p => !used.has(p.mpId));

  return (
    <div className="space-y-3">
      {pitchers.length > 0 && (
        <div>
          <div className="text-[11px] font-semibold text-blue-800 mb-1">선발투수</div>
          <div className="space-y-1.5">{pitchers.map(p => <Card key={p.mpId} p={p} />)}</div>
        </div>
      )}
      {batters.length > 0 && (
        <div>
          <div className="text-[11px] font-semibold text-emerald-800 mb-1">타순</div>
          <div className="space-y-1.5">{batters.map(p => <Card key={p.mpId} p={p} order={p.battingOrder as number} />)}</div>
        </div>
      )}
      {bench.length > 0 && (
        <div>
          <div className="text-[11px] font-semibold text-gray-500 mb-1">교체·벤치</div>
          <div className="space-y-1.5">{bench.map(p => <Card key={p.mpId} p={p} />)}</div>
        </div>
      )}
    </div>
  );
}
