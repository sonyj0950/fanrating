"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isKboStartingPitcher, KBO_BATTER_POSITIONS, KBO_SUB_KINDS, KBO_TEAM_LABELS } from "@/lib/kboTeams";

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
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");

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
          const pit = ent.find(isKboStartingPitcher);
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

  if (loading) return <p className="text-sm text-wfaint">불러오는 중…</p>;
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

  const curTeam = tab === "home" ? match.homeTeam : match.awayTeam;

  // ↩ 같은 팀의 가장 최근 경기 라인업을 현재 탭에 복사
  async function loadRecent() {
    setMsg("");
    const res = await fetch(`/api/admin/kbo/lineup?matchId=${matchId}&recentFor=${encodeURIComponent(curTeam)}`);
    const j = await res.json();
    if (!res.ok) { setMsg(j.error || "최근 라인업이 없습니다."); return; }
    setNameMap(nm => ({ ...nm, ...j.names }));
    setSide(s => ({ pitcherId: j.pitcherId || s.pitcherId, batters: j.batters }));
    setMsg(`${KBO_TEAM_LABELS[curTeam] || curTeam} — ${j.sourceLabel} 라인업을 불러왔습니다. 바뀐 자리만 고치고 저장하세요.`);
  }

  // 📋 붙여넣기 파서 — "1 신민재 2루수" / "선발 임찬규" 형식 인식, 로스터 이름과 대조
  function normPos(tok: string): string | null {
    const t = tok.trim();
    const all = KBO_BATTER_POSITIONS as readonly string[];
    if (all.includes(t)) return t;
    if (t === "지타" || t.toUpperCase() === "DH") return "지명타자";
    if (all.includes(t + "수")) return t + "수";
    return null;
  }
  function findByName(name: string, list: RP[]): RP | undefined {
    const n = name.replace(/\s+/g, "");
    return n ? list.find(p => p.name.replace(/\s+/g, "") === n) : undefined;
  }
  // 이름이 아닌 토큰: 타율 등 숫자, 투타 표기(좌타·우투좌타…), 라벨성 단어
  function isNoise(t: string): boolean {
    return /^[0-9.%:-]+$/.test(t) || /^[좌우양][투타]/.test(t) || t === "타율" || t === "타순";
  }
  function applyPaste() {
    const bs = emptyBatters();
    let pitcherId = "";
    const issues: string[] = [];
    for (const raw of pasteText.split("\n")) {
      const s = raw.replace(/[()\[\],·|/]/g, " ").replace(/\s+/g, " ").trim();
      if (!s) continue;
      const m = s.match(/^([1-9])\s*[.)번:]?\s*(.+)$/);
      if (m) {
        const order = Number(m[1]);
        const tokens = m[2].split(" ").filter(t => t && !isNoise(t));
        let pos = "";
        const nameToks: string[] = [];
        for (const t of tokens) {
          const p = normPos(t);
          if (p && !pos) pos = p;
          else nameToks.push(t);
        }
        const name = nameToks.join(" ");
        const found = findByName(name, batters) || findByName(name, roster);
        if (!found) { issues.push(`${order}번 "${name}" 로스터에 없음`); continue; }
        bs[order - 1] = { playerId: found.id, position: pos || found.position || "" };
      } else {
        const tokens = s.split(" ").filter(t => !/^(선발|투수|SP)$/i.test(t) && !isNoise(t));
        const name = tokens.join(" ");
        const found = findByName(name, pitchers) || findByName(name, roster);
        if (found) pitcherId = found.id;
        else if (name) issues.push(`"${name}" 인식 못 함`);
      }
    }
    const filled = bs.filter(b => b.playerId).length;
    if (!filled && !pitcherId) {
      setMsg('인식된 선수가 없습니다. 한 줄에 한 명 — 타순은 "1 신민재 2루수", 선발투수는 "선발 임찬규" 형식.');
      return;
    }
    setSide(s => ({
      pitcherId: pitcherId || s.pitcherId,
      batters: bs.map((b, i) => (b.playerId ? b : s.batters[i])),
    }));
    setPasteText("");
    setMsg(`붙여넣기 적용 — 타순 ${filled}자리${pitcherId ? " + 선발투수" : ""}` +
      (issues.length ? ` · 확인 필요: ${issues.join(", ")}` : ""));
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
      <a href="/admin" className="text-sm text-wfaint hover:underline">← 관리자</a>

      <div className="bg-card rounded p-4 shadow my-3">
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <span className="font-semibold">{KBO_TEAM_LABELS[match.awayTeam] || match.awayTeam}</span>
          <span className="text-xs text-wfaint">원정</span>
          <input className="border rounded p-1 w-14 text-center text-lg" value={form.awayScore} onChange={e => setForm({ ...form, awayScore: e.target.value })} />
          <span className="text-wfaint">:</span>
          <input className="border rounded p-1 w-14 text-center text-lg" value={form.homeScore} onChange={e => setForm({ ...form, homeScore: e.target.value })} />
          <span className="font-semibold">{KBO_TEAM_LABELS[match.homeTeam] || match.homeTeam}</span>
          <span className="text-xs text-golddim bg-goldbg rounded px-1.5 py-0.5">홈</span>
          <select className="border rounded p-1 text-sm" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
            <option value="finished">종료</option><option value="live">진행중</option><option value="scheduled">예정</option>
          </select>
        </div>
      </div>

      <div className="flex gap-2 mb-3">
        {(["home", "away"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`text-sm px-3 py-1.5 rounded border ${tab === t ? "bg-blue-600 text-white border-blue-600" : "bg-card"}`}>
            {(KBO_TEAM_LABELS[t === "home" ? match.homeTeam : match.awayTeam] || "")} · {t === "home" ? "홈" : "원정"}
          </button>
        ))}
      </div>

      {msg && <p className="text-sm mb-3 bg-goldbg border border-goldline rounded px-3 py-2">{msg}</p>}

      {/* 빠른 입력 도구 — 현재 탭 팀에만 적용 */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button onClick={loadRecent}
          className="text-sm px-3 py-1.5 rounded border bg-card hover:bg-paper font-semibold">
          ↩ 최근 라인업 불러오기
        </button>
        <button onClick={() => setPasteOpen(v => !v)}
          className={`text-sm px-3 py-1.5 rounded border font-semibold ${pasteOpen ? "bg-goldbg border-goldline text-golddim" : "bg-card hover:bg-paper"}`}>
          📋 붙여넣기로 채우기
        </button>
        <span className="text-[11px] text-wfaint">
          {KBO_TEAM_LABELS[curTeam] || curTeam} 탭에 적용됩니다
        </span>
      </div>
      {pasteOpen && (
        <div className="bg-card rounded p-3 shadow mb-3">
          <textarea className="border rounded p-2 w-full h-28 text-sm" value={pasteText}
            placeholder={"한 줄에 한 명 — 타순·이름·포지션 순서, 괄호·쉼표 섞여도 OK\n1 신민재 2루수\n2 박해민 (중견수)\n…\n선발 임찬규"}
            onChange={e => setPasteText(e.target.value)} />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[11px] text-wfaint">이름이 1군 로스터와 일치해야 채워집니다 (없으면 확인 목록으로 표시)</span>
            <button onClick={applyPaste} disabled={!pasteText.trim()}
              className="text-sm px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-40">적용</button>
          </div>
        </div>
      )}

      <div className="bg-card rounded p-4 shadow mb-3">
        <div className="flex items-center gap-3 pb-2 mb-2 border-b">
          <span className="text-sm font-semibold text-sky-300 w-16">선발투수</span>
          <select className="border rounded p-1.5 text-sm flex-1" value={side.pitcherId} onChange={e => setSide(s => ({ ...s, pitcherId: e.target.value }))}>
            {opt(pitchers, side.pitcherId)}
          </select>
        </div>
        {side.batters.map((bt, i) => (
          <div key={i} className="grid grid-cols-[28px_1fr_120px] gap-2 items-center py-1 border-b last:border-0">
            <span className="text-sm font-semibold text-center text-emerald-300 bg-wsoft rounded py-1">{i + 1}</span>
            <select className="border rounded p-1.5 text-sm" value={bt.playerId} onChange={e => setBatter(i, { playerId: e.target.value })}>
              {opt(batters, bt.playerId)}
            </select>
            <select className="border rounded p-1.5 text-sm" value={bt.position} onChange={e => setBatter(i, { position: e.target.value })}>
              <option value="">포지션</option>
              {KBO_BATTER_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        ))}
        <p className="text-[11px] text-wfaint mt-2">선수는 정비된 1군 로스터에서만 선택됩니다.</p>
      </div>

      <div className="bg-card rounded p-4 shadow mb-3">
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
            <span className="text-center text-wfaint">→</span>
            <select className="border rounded p-1 text-sm" value={s.inPlayerId} onChange={e => setSubs(v => v.map((x, j) => j === i ? { ...x, inPlayerId: e.target.value } : x))}>
              <option value="">들어온 선수</option>{allRoster.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button onClick={() => setSubs(v => v.filter((_, j) => j !== i))} className="text-wfaint hover:text-red-600" aria-label="삭제">✕</button>
          </div>
        ))}
        <button onClick={() => setSubs(v => [...v, { minute: "", kind: "", outPlayerId: "", inPlayerId: "" }])}
          className="text-sm mt-2 px-3 py-1 border rounded hover:bg-paper">+ 교체 추가</button>
      </div>

      <button onClick={save} disabled={saving}
        className="w-full py-2.5 rounded bg-blue-600 text-white font-semibold disabled:opacity-40">
        {saving ? "저장 중…" : "라인업 저장"}
      </button>
    </div>
  );
}
