"use client";
import { useState } from "react";

type LeagueKey = "kbo" | "lck" | "epl";
const LEAGUES: { key: LeagueKey; label: string; auto?: boolean; hint: string }[] = [
  { key: "kbo", label: "⚾ KBO", hint: "순위,팀(약칭),경기,승,패,무  — 예: 1,KIA,79,48,29,2" },
  { key: "lck", label: "🎮 LCK", hint: "순위,팀,경기,승,패,무[,세트]  — 예: 1,한화생명,18,14,4,0,30-12" },
  { key: "epl", label: "⚽ EPL", auto: true, hint: "API 자동 — 버튼으로 즉시 갱신" },
];

export default function StandingsPanel() {
  const [open, setOpen] = useState(false);
  const [league, setLeague] = useState<LeagueKey>("kbo");
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const cur = LEAGUES.find(l => l.key === league)!;

  async function load() {
    setMsg(""); setText("");
    try {
      const res = await fetch(`/api/admin/standings?league=${league}`);
      const j = await res.json();
      if (!res.ok) { setMsg("불러오기 실패: " + (j.error || "")); return; }
      const lines = (j.rows || []).map((r: any) =>
        [r.rank, r.team, r.played ?? "", r.win ?? "", r.loss ?? "", r.draw ?? "", r.note ?? ""]
          .join(",").replace(/,+$/, ""));
      setText(lines.join("\n"));
      if (!lines.length) setMsg("저장된 순위가 없습니다. 새로 입력하세요.");
    } catch (e: any) { setMsg("불러오기 실패: " + e.message); }
  }

  async function save() {
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/admin/standings", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ league, text }),
      });
      const j = await res.json();
      if (!res.ok) { setMsg("저장 실패: " + (j.error || "")); return; }
      setMsg(j.auto ? `EPL 순위 ${j.count}팀 자동 갱신됨` : `저장 완료 — ${j.count}팀`);
    } catch (e: any) { setMsg("저장 실패: " + e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="bg-white rounded p-4 shadow mb-6">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 w-full text-left">
        <h2 className="font-bold">🏆 순위 관리</h2>
        <span className="text-xs text-gray-400">KBO·LCK 수동 입력 · EPL 자동(API)</span>
        <span className="ml-auto text-gray-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-3">
          <div className="flex gap-1.5 mb-3">
            {LEAGUES.map(l => (
              <button key={l.key} onClick={() => { setLeague(l.key); setText(""); setMsg(""); }}
                className={`text-sm px-3 py-1.5 rounded border ${league === l.key ? "bg-blue-600 text-white border-blue-600" : "bg-white"}`}>
                {l.label}{l.auto ? " ·자동" : ""}
              </button>
            ))}
          </div>

          {msg && <p className="text-sm mb-2 bg-amber-50 border border-amber-200 rounded px-3 py-2">{msg}</p>}

          {cur.auto ? (
            <div className="border rounded p-3 bg-gray-50">
              <p className="text-sm text-gray-600 mb-2">EPL은 API-Football에서 자동으로 받아옵니다. 평소엔 동기화 cron이 갱신하고, 아래 버튼으로 즉시 갱신할 수 있습니다.</p>
              <button onClick={save} disabled={busy}
                className="text-sm px-3 py-1.5 rounded bg-blue-600 text-white disabled:opacity-40">
                {busy ? "갱신 중…" : "지금 EPL 순위 갱신"}
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-gray-500">{cur.hint}</p>
                <button onClick={load} className="text-xs px-2 py-0.5 border rounded hover:bg-gray-50">기존 불러오기</button>
              </div>
              <textarea value={text} onChange={e => setText(e.target.value)}
                placeholder={cur.hint}
                className="w-full h-40 border rounded p-2 text-sm font-mono" />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-gray-400">승률·게임차 등 파생값은 표시 시 자동 계산</span>
                <button onClick={save} disabled={busy}
                  className="text-sm px-4 py-1.5 rounded bg-blue-600 text-white disabled:opacity-40">
                  {busy ? "저장 중…" : "순위 저장"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
