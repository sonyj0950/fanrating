"use client";
import { useEffect, useState } from "react";
import { KBO_TEAMS, KBO_TEAM_LABELS } from "@/lib/kboTeams";

type P = { id: string; name: string; position: string | null; isPitcher: boolean | null; rosterActive: boolean };

export default function RosterPanel() {
  const [team, setTeam] = useState<string>(KBO_TEAMS[0]);
  const [players, setPlayers] = useState<P[]>([]);
  const [loading, setLoading] = useState(false);
  const [paste, setPaste] = useState("");
  const [msg, setMsg] = useState("");

  async function load(t: string) {
    setLoading(true); setMsg("");
    try {
      const res = await fetch(`/api/admin/roster?team=${encodeURIComponent(t)}`);
      const j = await res.json();
      if (!res.ok) { setMsg("불러오기 실패: " + (j.error || "")); setPlayers([]); return; }
      setPlayers(j.players || []);
    } catch (e: any) { setMsg("불러오기 실패: " + e.message); setPlayers([]); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(team); /* eslint-disable-next-line */ }, [team]);

  async function patch(id: string, body: any) {
    setPlayers(ps => ps.map(p => p.id === id ? { ...p, ...body } : p)); // 낙관적 업데이트
    await fetch("/api/admin/roster", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerId: id, ...body }),
    });
  }

  async function addPaste() {
    if (!paste.trim()) return;
    setLoading(true); setMsg("");
    try {
      const res = await fetch("/api/admin/roster", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ team, text: paste }),
      });
      const j = await res.json();
      if (!res.ok) { setMsg("추가 실패: " + (j.error || "")); return; }
      setMsg(`추가 ${j.added}명 · 재등록 ${j.updated}명`);
      setPaste("");
      load(team);
    } catch (e: any) { setMsg("추가 실패: " + e.message); }
    finally { setLoading(false); }
  }

  const pitchers = players.filter(p => p.isPitcher);
  const batters = players.filter(p => !p.isPitcher);
  const sortActive = (a: P, b: P) => Number(b.rosterActive) - Number(a.rosterActive);
  const activeCount = players.filter(p => p.rosterActive).length;

  function Row({ p }: { p: P }) {
    return (
      <div className={`flex items-center justify-between py-1.5 border-b last:border-0 ${p.rosterActive ? "" : "opacity-50"}`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm truncate">{p.name}</span>
          {p.position && <span className="text-[11px] text-gray-500 bg-gray-100 rounded px-1.5 py-0.5 shrink-0">{p.position}</span>}
          {!p.rosterActive && <span className="text-[11px] text-red-600 bg-red-50 rounded px-1.5 py-0.5 shrink-0">2군</span>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => patch(p.id, { isPitcher: !p.isPitcher })}
            className="text-[11px] px-1.5 py-0.5 text-gray-400 hover:text-gray-700" title="투수/타자 전환">
            {p.isPitcher ? "→타자" : "→투수"}
          </button>
          <button onClick={() => patch(p.id, { rosterActive: !p.rosterActive })}
            className="text-[11px] px-2 py-0.5 border rounded hover:bg-gray-50">
            {p.rosterActive ? "말소" : "복귀"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded p-4 shadow mb-6">
      <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
        <h2 className="font-bold">⚾ KBO 로스터 관리 <span className="text-xs font-normal text-gray-500">(매주 월요일 갱신)</span></h2>
        <select className="border rounded p-1.5 text-sm" value={team} onChange={e => setTeam(e.target.value)}>
          {KBO_TEAMS.map(t => <option key={t} value={t}>{KBO_TEAM_LABELS[t]}</option>)}
        </select>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        1군 등록 <b>{activeCount}</b>명 · 투수 {pitchers.filter(p=>p.rosterActive).length} · 타자 {batters.filter(p=>p.rosterActive).length}
        {loading && " · 불러오는 중…"}
      </p>

      {msg && <p className="text-sm mb-3 bg-amber-50 border border-amber-200 rounded px-3 py-2">{msg}</p>}

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="border rounded p-3">
          <div className="text-sm font-semibold text-blue-800 mb-1">투수 <span className="text-gray-400 font-normal">{pitchers.length}</span></div>
          {pitchers.length ? pitchers.sort(sortActive).map(p => <Row key={p.id} p={p} />)
            : <p className="text-xs text-gray-400 py-2">선수 없음 — 아래에서 명단을 붙여넣어 추가하세요.</p>}
        </div>
        <div className="border rounded p-3">
          <div className="text-sm font-semibold text-emerald-800 mb-1">타자 <span className="text-gray-400 font-normal">{batters.length}</span></div>
          {batters.length ? batters.sort(sortActive).map(p => <Row key={p.id} p={p} />)
            : <p className="text-xs text-gray-400 py-2">선수 없음 — 아래에서 명단을 붙여넣어 추가하세요.</p>}
        </div>
      </div>

      <div className="mt-4 bg-gray-50 rounded p-3">
        <div className="text-sm font-semibold mb-1">명단 붙여넣기로 추가 — {KBO_TEAM_LABELS[team]}</div>
        <textarea className="border rounded p-2 w-full h-24 text-sm"
          placeholder={"한 줄에 한 명 (이름,포지션) — 포지션으로 투/타 자동 분류\n예) 임찬규,투수\n홍창기,우익수"}
          value={paste} onChange={e => setPaste(e.target.value)} />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] text-gray-400">관리자가 직접 입력 · 외부 자동수집 없음</span>
          <button onClick={addPaste} disabled={loading || !paste.trim()}
            className="text-sm px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-40">추가</button>
        </div>
      </div>
    </div>
  );
}
