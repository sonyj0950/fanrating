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
  // 목록에 없는 팀(BLG·해외팀·국대 등) 직접 추가
  const [newTeam, setNewTeam] = useState("");
  const [newColor, setNewColor] = useState("#2563eb");

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
    <div className="bg-card rounded p-4 shadow mb-6">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 w-full text-left">
        <h2 className="font-bold">🎨 구단 색상</h2>
        <span className="text-xs text-wfaint">공식색이 기본 · 바꾸면 평점 마커·범례에 적용</span>
        <span className="ml-auto text-wfaint">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          {msg && <p className="text-sm bg-goldbg border border-goldline rounded px-3 py-2">{msg}</p>}
          {(() => {
            // 고정 목록(KBO·LCK) 밖에서 오버라이드된 팀 — 경기 등록 때 색을 지정한 신규 팀들
            const known = new Set<string>(GROUPS.flatMap(g => [...g.teams]));
            const extra = Object.keys(overrides).filter(t => !known.has(t)).sort((a, b) => a.localeCompare(b, "ko"));
            return (
              <div>
                <p className="text-[11px] font-semibold text-wfaint mb-1.5">🎯 기타 팀 (직접 추가 — 목록에 없는 팀)</p>
                {extra.length > 0 && (
                  <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5 mb-2">
                    {extra.map(team => (
                      <div key={team} className="flex items-center gap-2 py-0.5">
                        <span className="w-5 h-5 rounded-md border shrink-0" style={{ background: overrides[team] }} />
                        <span className="flex-1 text-sm truncate">{team}</span>
                        <button onClick={() => reset(team)} disabled={busy === team}
                          className="text-[11px] px-2 py-0.5 border rounded hover:bg-paper disabled:opacity-40">삭제</button>
                        <input type="color" value={overrides[team].toLowerCase()} disabled={busy === team}
                          onChange={e => save(team, e.target.value)}
                          className="w-7 h-6 p-0 border rounded cursor-pointer disabled:opacity-40" />
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input value={newTeam} onChange={e => setNewTeam(e.target.value)}
                    placeholder="팀명 (경기 등록에 쓰는 표기 그대로 — 예: BLG)"
                    className="border rounded p-1.5 text-sm flex-1 min-w-0" />
                  <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)}
                    className="w-9 h-8 p-0 border rounded cursor-pointer" aria-label="새 팀 색" />
                  <button onClick={async () => { const t = newTeam.trim(); if (!t) return;
                      await save(t, newColor); setNewTeam(""); }}
                    disabled={!newTeam.trim() || !!busy}
                    className="text-sm px-3 py-1.5 rounded bg-blue-600 text-white disabled:opacity-40 shrink-0">추가</button>
                </div>
              </div>
            );
          })()}
          {GROUPS.map(g => (
            <div key={g.label}>
              <p className="text-[11px] font-semibold text-wfaint mb-1.5">{g.label}</p>
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
                      {!custom && <span className="text-[11px] text-wfaint font-mono">{color.toUpperCase()}</span>}
                      {custom && (
                        <button onClick={() => reset(team)} disabled={busy === team}
                          className="text-[11px] px-2 py-0.5 border rounded hover:bg-paper disabled:opacity-40">기본</button>
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
          <p className="text-[11px] text-wfaint">색을 바꾸면 즉시 저장됩니다. 경기 페이지에서 새로고침 시 반영돼요.</p>
        </div>
      )}
    </div>
  );
}
