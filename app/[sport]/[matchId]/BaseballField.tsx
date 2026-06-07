"use client";
import type { Player } from "./types";

// 야구: 역할(선발/유격수 등) 기준의 컴팩트 카드 목록
export default function BaseballField({ players, onPick }:
  { players: Player[]; onPick: (p: Player) => void }) {
  if (players.length === 0)
    return <p className="text-sm text-gray-400 bg-white border rounded p-4">등록된 선수가 없습니다.</p>;

  return (
    <div className="grid grid-cols-2 gap-2">
      {players.map(p => (
        <button key={p.mpId} onClick={() => onPick(p)}
          className="bg-white border rounded-lg p-2.5 text-left hover:border-blue-400 hover:shadow-sm transition">
          <div className="flex items-center justify-between gap-1">
            <span className="font-semibold text-sm truncate">{p.name}</span>
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full shrink-0
              ${p.avg !== null ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-400"}`}>
              {p.avg !== null ? `⭐ ${p.avg}` : "－"}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5 truncate">
            {p.role || "－"}{p.count > 0 ? ` · ${p.count}명` : ""}
          </div>
        </button>
      ))}
    </div>
  );
}
