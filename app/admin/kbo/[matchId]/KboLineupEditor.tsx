"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KBO_BATTER_POSITIONS, KBO_SUB_KINDS, KBO_TEAM_LABELS } from "@/lib/kboTeams";

type RP = { id: string; name: string; position: string | null; isPitcher: boolean | null };
type Batter = { playerId: string; position: string };
type Side = { pitcherId: string; batters: Batter[] };
type Sub = { minute: string; kind: string; outPlayerId: string; inPlayerId: string };

const emptyBatters = (): Batter[] => Array.from({ length: 9 }, () => ({ playerId: "", position: "" }));

export default function KboLineupEditor({ matchId }: { matchId: string }) {
  const r = useRouter();
  const [match, setMatch] = useState<any>(null);
  const [homeRoster, setHomeRoster] = useState<RP[]>([]);
  const [awayRoster, setAwayRoster] = useState<RP[]>([]);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ homeScore: "", awayScore: "", status: "finished" });
  const [home, setHome] = useState<Side>({ pitcherId: "", batters: emptyBatters() });
  const [away, setAway] = useState<Side>({ pitcherId: "", batters: emptyBatters() });
  const [subs, setSubs] = useState<Sub[]>([]);
  const [tab, setTab] = useState<"home" | "away">("home");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/admin/kbo/lineup?matchId=${matchId}`);
        const j = await res.json();
        if (!res.ok) { setMsg("불러오기 실패: " + (j.error || "")); return; }
        setMatch(j.match);
        setHomeRoster(j.homeRoster); setAwayRoster(j.awayRoster);
        setForm({ homeScore: j.match.homeScore ?? "", awayScore: j.match.awayScore ?? "", status: j.match.status || "finished" });

        const nm: Record<string, string> = {};
        [...j.homeRoster, ...j.awayRoster].forEach((p: RP) => (nm[p.id] = p.name));
        (j.lineup || []).forEach((l: any) => (nm[l.playerId] = l.player.name));
        setNameMap(nm);

        const build = (team: string): Side => {
          const ent = (j.lineup || []).filter((l: any) => l.player.team === team);
          const pit = ent.find((l: any) => l.role === "투수" && l.battingOrder == null);
          const bs = emptyBatters();
          ent.forEach((l: any) => { if (l.battingOrder >= 1 && l.battingOrder <= 9) bs[l.battingOrder - 1] = { playerId: l.playerId, position: l.role || "" }; });
          return { pitcherId: pit ? pit.playerId : "", batters: bs };
        };
        setHome(build(j.match.homeTeam));
        setAway(build(j.match.awayTeam));
        setSubs((j.subs || []).map((s: any) => ({ minute: String(s.minute ?? ""), kind: s.kind || "", outPlayerId: s.outPlayerId, inPlayerId: s.inPlayerId })));
      } catch (e: any) { setMsg("불러오기 실패: " + e.message); }
      finally { setLoading(false); }
    })();
  }, [matchId]);

  if (loading) return <p className="text-sm text-gray-500">불러오는 중…</p>;
  if (!match) return <p className="text-sm text-red-600">{msg || "경기를 찾을 수 없습니다."}</p>;

  const side = tab === "home" ? home : away;
  const setSide = tab === "home" ? setHome : setAway;
  const roster = tab === "home" ? homeRoster : awayRoster;
  const pitchers = roster.filter(p => p.isPitcher);
  const batters = roster.filter(p => !p.isPitcher);
  const allRoster = [...homeRoster.map(p => ({ ...p, team: match.homeTeam })), ...awayRoster.map(p => ({ ...p, team: match.awayTeam }))];

  const opt = (list: { id: string; name: string }[], current: string) => {
    const has = list.some(p => p.id === current);
    return (
      <>
        <option value="">선택</option>
        {!has && current && <option value={current}>{nameMap[current] || current}</option>}
        {list.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </>
    );
  };

  function setBatter(i: number, patch: Partial<Batter>) {
    setSide(s => {
      const bs = s.batters.slice();
      const next = { ...bs[i], ...patch };
      if (patch.playerId && !next.position) {
        const p = roster.find(x => x.id === patch.playerId);
        if (p?.position) next.position = p.position;
      }
      bs[i] = next;
      return { ...s, batters: bs };
    });
  }

  async function save() {
    setSaving(true); setMsg("");
    try {
      const res = await fetch("/api/admin/kbo/lineup", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ matchId, ...form, home, away, subs }),
      });
      const j = await res.json();
      if (!res.ok) { setMsg("저장 실패: " + (j.error || "")); return; }
      setMsg(`저장 완료 — 선수 ${j.players}명 · 교체 ${j.subs}건`);
      r.refresh();
    } catch (e: any) { setMsg("저장 실패: " + e.message); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <a href="/admin" className="text-sm text-gray-500 hover:underline">← 관리자</a>

      <div className="bg-white rounded p-4 shadow my-3">
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <span className="font-semibold">{KBO_TEAM_LABELS[match.awayTeam] || match.awayTeam}</span>
          <span className="text-xs text-gray-400">원정</span>
          <input className="border rounded p-1 w-14 text-center text-lg" value={form.awayScore} onChange={e => setForm({ ...form, awayScore: e.target.value })} />
          <span className="text-gray-400">:</span>
          <input className="border rounded p-1 w-14 text-center text-lg" value={form.homeScore} onChange={e => setForm({ ...form, homeScore: e.target.value })} />
          <span className="font-semibold">{KBO_TEAM_LABELS[match.homeTeam] || match.homeTeam}</span>
          <span className="text-xs text-blue-700 bg-blue-50 rounded px-1.5 py-0.5">홈</span>
          <select className="border rounded p-1 text-sm" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
            <option value="finished">종료</option><option value="live">진행중</option><option value="scheduled">예정</option>
          </select>
        </div>
      </div>

      <div className="flex gap-2 mb-3">
        {(["home", "away"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`text-sm px-3 py-1.5 rounded border ${tab === t ? "bg-blue-600 text-white border-blue-600" : "bg-white"}`}>
            {(KBO_TEAM_LABELS[t === "home" ? match.homeTeam : match.awayTeam] || "")} · {t === "home" ? "홈" : "원정"}
          </button>
        ))}
      </div>

      {msg && <p className="text-sm mb-3 bg-amber-50 border border-amber-200 rounded px-3 py-2">{msg}</p>}

      <div className="bg-white rounded p-4 shadow mb-3">
        <div className="flex items-center gap-3 pb-2 mb-2 border-b">
          <span className="text-sm font-semibold text-blue-800 w-16">선발투수</span>
          <select className="border rounded p-1.5 text-sm flex-1" value={side.pitcherId} onChange={e => setSide(s => ({ ...s, pitcherId: e.target.value }))}>
            {opt(pitchers, side.pitcherId)}
          </select>
        </div>
        {side.batters.map((bt, i) => (
          <div key={i} className="grid grid-cols-[28px_1fr_120px] gap-2 items-center py-1 border-b last:border-0">
            <span className="text-sm font-semibold text-center text-emerald-800 bg-emerald-50 rounded py-1">{i + 1}</span>
            <select className="border rounded p-1.5 text-sm" value={bt.playerId} onChange={e => setBatter(i, { playerId: e.target.value })}>
              {opt(batters, bt.playerId)}
            </select>
            <select className="border rounded p-1.5 text-sm" value={bt.position} onChange={e => setBatter(i, { position: e.target.value })}>
              <option value="">포지션</option>
              {KBO_BATTER_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        ))}
        <p className="text-[11px] text-gray-400 mt-2">선수는 정비된 1군 로스터에서만 선택됩니다.</p>
      </div>

      <div className="bg-white rounded p-4 shadow mb-3">
        <div className="text-sm font-semibold mb-2">교체 기록</div>
        {subs.map((s, i) => (
          <div key={i} className="grid grid-cols-[48px_84px_1fr_18px_1fr_28px] gap-1.5 items-center py-1">
            <input className="border rounded p-1 text-sm text-center" placeholder="회" value={s.minute}
              onChange={e => setSubs(v => v.map((x, j) => j === i ? { ...x, minute: e.target.value } : x))} />
            <select className="border rounded p-1 text-sm" value={s.kind} onChange={e => setSubs(v => v.map((x, j) => j === i ? { ...x, kind: e.target.value } : x))}>
              <option value="">종류</option>{KBO_SUB_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
            <select className="border rounded p-1 text-sm" value={s.outPlayerId} onChange={e => setSubs(v => v.map((x, j) => j === i ? { ...x, outPlayerId: e.target.value } : x))}>
              <option value="">나간 선수</option>{allRoster.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <span className="text-center text-gray-400">→</span>
            <select className="border rounded p-1 text-sm" value={s.inPlayerId} onChange={e => setSubs(v => v.map((x, j) => j === i ? { ...x, inPlayerId: e.target.value } : x))}>
              <option value="">들어온 선수</option>{allRoster.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button onClick={() => setSubs(v => v.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-600" aria-label="삭제">✕</button>
          </div>
        ))}
        <button onClick={() => setSubs(v => [...v, { minute: "", kind: "", outPlayerId: "", inPlayerId: "" }])}
          className="text-sm mt-2 px-3 py-1 border rounded hover:bg-gray-50">+ 교체 추가</button>
      </div>

      <button onClick={save} disabled={saving}
        className="w-full py-2.5 rounded bg-blue-600 text-white font-semibold disabled:opacity-40">
        {saving ? "저장 중…" : "라인업 저장"}
      </button>
    </div>
  );
}
