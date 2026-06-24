"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LCK_LANES } from "@/lib/lckLanes";

type SetData = { winner: string; home: Record<string, string>; away: Record<string, string> };
const blank = (): Record<string, string> => Object.fromEntries(LCK_LANES.map(l => [l.code, ""])) as Record<string, string>;

export default function LckLineupEditor({ matchId }: { matchId: string }) {
  const r = useRouter();
  const [match, setMatch] = useState<any>(null);
  const [homeRoster, setHomeRoster] = useState<string[]>([]);
  const [awayRoster, setAwayRoster] = useState<string[]>([]);
  const [homeNames, setHomeNames] = useState<Record<string, string>>(blank());
  const [awayNames, setAwayNames] = useState<Record<string, string>>(blank());
  const [sets, setSets] = useState<SetData[]>([]);
  const [status, setStatus] = useState("finished");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/admin/lck/lineup?matchId=${matchId}`);
        const j = await res.json();
        if (!res.ok) { setMsg("불러오기 실패: " + (j.error || "")); return; }
        setMatch(j.match); setStatus(j.match.status || "finished");
        setHomeRoster((j.homeRoster || []).map((p: any) => p.name));
        setAwayRoster((j.awayRoster || []).map((p: any) => p.name));

        const hn = blank(), an = blank();
        const champBy: any = { home: {}, away: {} };
        let maxSet = 0;
        for (const l of (j.lineup || [])) {
          if (!LCK_LANES.some(x => x.code === l.role)) continue;
          const side = l.player.team === j.match.homeTeam ? "home" : "away";
          (side === "home" ? hn : an)[l.role] = l.player.name;
          const ch = l.champions || {};
          champBy[side][l.role] = ch;
          for (const k of Object.keys(ch)) { const n = parseInt(k.replace("set", "")); if (n > maxSet) maxSet = n; }
        }
        setHomeNames(hn); setAwayNames(an);

        const sr = j.match.setResults || {};
        const count = Math.max(maxSet, Object.keys(sr).length, (j.match.homeScore || 0) + (j.match.awayScore || 0), 1);
        const arr: SetData[] = [];
        for (let i = 1; i <= count; i++) {
          const home = blank(), away = blank();
          for (const l of LCK_LANES) {
            home[l.code] = champBy.home[l.code]?.[`set${i}`] || "";
            away[l.code] = champBy.away[l.code]?.[`set${i}`] || "";
          }
          arr.push({ winner: sr[`set${i}`] || "", home, away });
        }
        setSets(arr);
      } catch (e: any) { setMsg("불러오기 실패: " + e.message); }
      finally { setLoading(false); }
    })();
  }, [matchId]);

  if (loading) return <p className="text-sm text-gray-500">불러오는 중…</p>;
  if (!match) return <p className="text-sm text-red-600">{msg || "경기를 찾을 수 없습니다."}</p>;

  const hw = sets.filter(s => s.winner === "home").length;
  const aw = sets.filter(s => s.winner === "away").length;

  const setChamp = (idx: number, side: "home" | "away", lane: string, v: string) =>
    setSets(ss => ss.map((s, i) => i === idx ? { ...s, [side]: { ...s[side], [lane]: v } } : s));

  async function save() {
    setSaving(true); setMsg("");
    try {
      const home = { team: match.homeTeam, players: LCK_LANES.map(l => ({ lane: l.code, name: homeNames[l.code] })) };
      const away = { team: match.awayTeam, players: LCK_LANES.map(l => ({ lane: l.code, name: awayNames[l.code] })) };
      const payloadSets = sets.map(s => ({ winner: s.winner, homeChamps: s.home, awayChamps: s.away }));
      const res = await fetch("/api/admin/lck/lineup", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ matchId, status, home, away, sets: payloadSets }),
      });
      const j = await res.json();
      if (!res.ok) { setMsg("저장 실패: " + (j.error || "")); return; }
      setMsg(`저장 완료 — 세트 ${j.sets} · 스코어 ${j.score} · 선수 ${j.players}명`);
      r.refresh();
    } catch (e: any) { setMsg("저장 실패: " + e.message); }
    finally { setSaving(false); }
  }

  const NameCol = ({ team, names, setNames, listId }:
    { team: string; names: Record<string, string>; setNames: (f: (n: Record<string, string>) => Record<string, string>) => void; listId: string }) => (
    <div>
      <div className="text-sm font-semibold mb-1.5">{team}</div>
      {LCK_LANES.map(l => (
        <div key={l.code} className="flex items-center gap-2 mb-1.5">
          <span className="w-9 text-[11px] text-gray-500 shrink-0">{l.label}</span>
          <input list={listId} value={names[l.code]} onChange={e => setNames(n => ({ ...n, [l.code]: e.target.value }))}
            className="border rounded p-1.5 text-sm flex-1" placeholder="선수명" />
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <a href="/admin" className="text-sm text-gray-500 hover:underline">← 관리자</a>

      <datalist id="home-roster">{homeRoster.map(n => <option key={n} value={n} />)}</datalist>
      <datalist id="away-roster">{awayRoster.map(n => <option key={n} value={n} />)}</datalist>

      <div className="bg-white rounded p-4 shadow my-3 flex items-center justify-center gap-3 flex-wrap">
        <span className="font-semibold">{match.awayTeam}</span>
        <span className="text-xs text-gray-400">원정</span>
        <span className="text-lg font-bold">{aw} : {hw}</span>
        <span className="font-semibold">{match.homeTeam}</span>
        <span className="text-xs text-blue-700 bg-blue-50 rounded px-1.5 py-0.5">홈</span>
        <select className="border rounded p-1 text-sm" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="finished">종료</option><option value="live">진행중</option><option value="scheduled">예정</option>
        </select>
      </div>

      {msg && <p className="text-sm mb-3 bg-amber-50 border border-amber-200 rounded px-3 py-2">{msg}</p>}

      <div className="bg-white rounded p-4 shadow mb-3">
        <div className="text-sm font-semibold mb-2">선수 명단 (라인별)</div>
        <div className="grid sm:grid-cols-2 gap-4">
          <NameCol team={match.homeTeam} names={homeNames} setNames={setHomeNames} listId="home-roster" />
          <NameCol team={match.awayTeam} names={awayNames} setNames={setAwayNames} listId="away-roster" />
        </div>
        <p className="text-[11px] text-gray-400 mt-2">한 번 입력한 선수는 다음 경기에서 자동완성으로 뜹니다.</p>
      </div>

      {sets.map((s, idx) => (
        <div key={idx} className="bg-white rounded p-4 shadow mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">세트 {idx + 1}</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-gray-400">승팀</span>
              {(["home", "away"] as const).map(w => (
                <button key={w} onClick={() => setSets(ss => ss.map((x, i) => i === idx ? { ...x, winner: x.winner === w ? "" : w } : x))}
                  className={`text-xs px-2 py-1 rounded border ${s.winner === w ? "bg-blue-600 text-white border-blue-600" : "bg-white"}`}>
                  {w === "home" ? match.homeTeam : match.awayTeam}
                </button>
              ))}
              <button onClick={() => setSets(ss => ss.filter((_, i) => i !== idx))} className="text-gray-400 hover:text-red-600 text-xs px-1" aria-label="세트 삭제">✕</button>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {(["home", "away"] as const).map(side => (
              <div key={side}>
                <div className="text-[11px] text-gray-500 mb-1">{side === "home" ? match.homeTeam : match.awayTeam} 챔피언</div>
                {LCK_LANES.map(l => (
                  <div key={l.code} className="flex items-center gap-2 mb-1.5">
                    <span className="w-9 text-[11px] text-gray-500 shrink-0">{l.label}</span>
                    <input value={s[side][l.code]} onChange={e => setChamp(idx, side, l.code, e.target.value)}
                      className="border rounded p-1.5 text-sm flex-1" placeholder="챔피언" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}

      <button onClick={() => setSets(ss => [...ss, { winner: "", home: blank(), away: blank() }])}
        className="text-sm mb-3 px-3 py-1.5 border rounded hover:bg-gray-50">+ 세트 추가</button>

      <button onClick={save} disabled={saving}
        className="w-full py-2.5 rounded bg-blue-600 text-white font-semibold disabled:opacity-40">
        {saving ? "저장 중…" : "라인업 저장"}
      </button>
    </div>
  );
}
