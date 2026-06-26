"use client";
import { useEffect, useState } from "react";
import { KBO_TEAMS, KBO_TEAM_LABELS } from "@/lib/kboTeams";
import { LCK_TEAMS } from "@/lib/lckLanes";
import { OFFICIAL_TEAM_COLORS } from "@/lib/teamColors";

const GROUPS: { label: string; teams: readonly string[]; labelMap?: Record<string, string> }[] = [
  { label: "⚾ KBO", teams: KBO_TEAMS, labelMap: KBO_TEAM_LABELS },
  { label: "🎮 LCK", teams: LCK_TEAMS },
];

export default function TeamColorPanel() {
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!open) return;
    fetch("/api/admin/team-color").then(r => r.json())
      .then(d => setOverrides(d.overrides || {})).catch(() => {});
  }, [open]);

  const colorOf = (team: string) => overrides[team] ?? OFFICIAL_TEAM_COLORS[team] ?? "#2563EB";
  const isCustom = (team: string) => overrides[team] != null;

  async function save(team: string, color: string) {
    setBusy(team); setMsg("");
    try {
      const res = await fetch("/api/admin/team-color", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ team, color }),
      });
      const j = await res.json();
      if (!res.ok) { setMsg("저장 실패: " + (j.error || "")); return; }
      setOverrides(o => {
        const n = { ...o };
        if (j.reverted) delete n[team]; else n[team] = color.toUpperCase();
        return n;
      });
    } catch (e: any) { setMsg("저장 실패: " + e.message); }
    finally { setBusy(""); }
  }

  async function reset(team: string) {
    setBusy(team); setMsg("");
    try {
      await fetch(`/api/admin/team-color?team=${encodeURIComponent(team)}`, { method: "DELETE" });
      setOverrides(o => { const n = { ...o }; delete n[team]; return n; });
    } catch (e: any) { setMsg("초기화 실패: " + e.message); }
    finally { setBusy(""); }
  }

  return (
    <div className="bg-white rounded p-4 shadow mb-6">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 w-full text-left">
        <h2 className="font-bold">🎨 구단 색상</h2>
        <span className="text-xs text-gray-400">공식색이 기본 · 바꾸면 평점 마커·범례에 적용</span>
        <span className="ml-auto text-gray-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          {msg && <p className="text-sm bg-amber-50 border border-amber-200 rounded px-3 py-2">{msg}</p>}
          {GROUPS.map(g => (
            <div key={g.label}>
              <p className="text-[11px] font-semibold text-gray-500 mb-1.5">{g.label}</p>
              <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5">
                {g.teams.map(team => {
                  const color = colorOf(team);
                  const custom = isCustom(team);
                  return (
                    <div key={team} className="flex items-center gap-2 py-0.5">
                      <span className="w-5 h-5 rounded-md border shrink-0" style={{ background: color }} />
                      <span className="flex-1 text-sm truncate">
                        {g.labelMap?.[team] ?? team}
                        {custom && <span className="text-[10px] text-amber-600 ml-1">수정됨</span>}
                      </span>
                      {!custom && <span className="text-[11px] text-gray-400 font-mono">{color.toUpperCase()}</span>}
                      {custom && (
                        <button onClick={() => reset(team)} disabled={busy === team}
                          className="text-[11px] px-2 py-0.5 border rounded hover:bg-gray-50 disabled:opacity-40">기본</button>
                      )}
                      <input type="color" value={color.toLowerCase()} disabled={busy === team}
                        onChange={e => save(team, e.target.value)}
                        className="w-7 h-6 p-0 border rounded cursor-pointer disabled:opacity-40" />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <p className="text-[11px] text-gray-400">색을 바꾸면 즉시 저장됩니다. 경기 페이지에서 새로고침 시 반영돼요.</p>
        </div>
      )}
    </div>
  );
}
