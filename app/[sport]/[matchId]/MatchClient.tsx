"use client";
import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import BaseballField from "./BaseballField";
import SoccerField from "./SoccerField";
import LckLineup from "./LckLineup";
import DeleteMatchButton from "@/components/DeleteMatchButton";
import ShareButton from "@/components/ShareButton";
import type { Player, Agg } from "./types";
import { POSITION_MAP, normalizeRole, GROUP_DEFAULT } from "@/lib/soccerPositions";

function segmentsFor(sport: string) {
  if (sport === "kleague") return [
    { key: "full", label: "총평" },
    { key: "first", label: "전반" },
    { key: "second", label: "후반" },
  ];
  if (sport === "lck") return [
    { key: "full", label: "총평" },
    { key: "set1", label: "1세트" },
    { key: "set2", label: "2세트" },
    { key: "set3", label: "3세트" },
    { key: "set4", label: "4세트" },
    { key: "set5", label: "5세트" },
  ];
  return [{ key: "full", label: "경기" }];
}

function applyAgg(players: Player[], agg: Agg, seg: string): Player[] {
  // LCK 총평 = 모든 set 평균의 평균
  if (seg === "full" && agg) {
    return players.map(p => {
      const segs = Object.keys(agg).filter(s => s !== "full");
      const vals = segs.map(s => agg[s]?.[p.playerId]).filter(Boolean);
      const fullData = agg["full"]?.[p.playerId];
      if (fullData && vals.length === 0) {
        return { ...p, avg: fullData.avg, count: fullData.count };
      }
      if (vals.length === 0 && !fullData) return { ...p, avg: null, count: 0 };
      const allCount = (fullData?.count || 0) + vals.reduce((a, v) => a + v.count, 0);
      const allSum = (fullData ? fullData.avg * fullData.count : 0) + vals.reduce((a, v) => a + v.avg * v.count, 0);
      return { ...p, avg: allCount ? Number((allSum / allCount).toFixed(2)) : null, count: allCount };
    });
  }
  return players.map(p => {
    const a = agg[seg]?.[p.playerId];
    return { ...p, avg: a ? a.avg : null, count: a ? a.count : 0 };
  });
}

type Sub = { minute: number; outPlayerId: string; inPlayerId: string };

export default function MatchClient({ match, players: rawPlayers, agg, subs = [] }:
  { match: any; players: Player[]; agg: Agg; subs?: Sub[] }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [seg, setSeg] = useState("full");
  const [open, setOpen] = useState<Player | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [editPos, setEditPos] = useState(false);
  const isAdmin = (session?.user as any)?.role === "admin";

  // 관리자: 선수 위치 드래그 저장
  async function savePosition(mpId: string, x: number, y: number, role?: string) {
    await fetch(`/api/match-player/${mpId}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify(role ? { posX: x, posY: y, role } : { posX: x, posY: y }),
    });
    router.refresh();
  }
  // 관리자: 모든 커스텀 위치 초기화 (포지션 코드 기준 자동 배치로 복귀)
  async function resetPositions() {
    if (!confirm("모든 선수 위치를 자동 배치로 되돌릴까요?")) return;
    await Promise.all(rawPlayers.map(p =>
      fetch(`/api/match-player/${p.mpId}`, {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ resetPos: true }),
      })
    ));
    router.refresh();
  }

  // 관리자: 토론거리 재생성
  async function regenSeed() {
    const res = await fetch(`/api/admin/match/${match.id}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ regenSeed: true }),
    });
    const j = await res.json().catch(() => ({}));
    if (!j.regenerated) {
      alert(j.message || "토론거리를 생성하지 못했습니다. (평점이 더 필요할 수 있습니다)");
      return;
    }
    router.refresh();
  }

  const segments = segmentsFor(match.sport);

  // 나의 평점: playerId -> 내가 매긴 점수(총평 우선, 없으면 가장 높은 구간 점수)
  const [myScores, setMyScores] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    if (!session) { setMyScores({}); return; }
    fetch(`/api/my-ratings?matchId=${match.id}`)
      .then(r => r.json())
      .then(d => {
        const map: Record<string, number> = {};
        for (const it of (d.items || [])) {
          // 같은 선수의 여러 구간 중 더 높은 점수를 대표로 (총평 우선)
          if (it.segment === "full" || map[it.playerId] === undefined)
            map[it.playerId] = it.score;
        }
        setMyScores(map);
      })
      .catch(() => setMyScores({}));
  }, [session, match.id]);

  const isMine = seg === "mine";
  // mine 탭에서는 각 선수의 avg를 "내 점수"로 교체
  const baseSeg = isMine ? "full" : seg;
  const players = useMemo(() => applyAgg(rawPlayers, agg, baseSeg), [rawPlayers, agg, baseSeg]);

  // 전반/후반 출전 구성: 총평·나의평점은 전체, 전/후반 탭은 해당 출전자만
  const segFiltered = players.filter(p =>
    baseSeg === "full" || !p.segment || p.segment === "all" || p.segment === baseSeg);

  // 야구: 기본 우선선수만, "더보기" 시 전체 (나의 평점 탭에서는 전체 표시)
  const visiblePlayers0 = (match.sport === "kbo" && !showAll && !isMine)
    ? segFiltered.filter(p => p.isDefault)
    : segFiltered;

  // mine 모드: avg를 내 점수로 교체 (안 매긴 선수는 null)
  const visiblePlayers = isMine
    ? visiblePlayers0.map(p => ({ ...p, avg: myScores?.[p.playerId] ?? null, count: myScores?.[p.playerId] !== undefined ? 1 : 0 }))
    : visiblePlayers0;

  // 감독/코치/심판 분리 (축구)
  const isOfficial = (p: Player) => /심판|주심|부심|VAR/i.test(p.role || "");
  const isStaff = (p: Player) => /감독|코치/.test(p.role || "");
  const officials = visiblePlayers.filter(isOfficial);
  const fieldPlayers = visiblePlayers.filter(p => !isOfficial(p) && !isStaff(p));

  const home = fieldPlayers.filter(p => p.team === match.homeTeam);
  const away = fieldPlayers.filter(p => p.team === match.awayTeam);
  const homeStaff = visiblePlayers.filter(p => isStaff(p) && p.team === match.homeTeam);
  const awayStaff = visiblePlayers.filter(p => isStaff(p) && p.team === match.awayTeam);

  // 교체 정보: playerId → 들어옴(in)/나감(out) + 시각
  const subInfo = useMemo(() => {
    const m: Record<string, { dir: "in" | "out"; min: number }> = {};
    for (const s of subs) {
      if (s.inPlayerId && m[s.inPlayerId] === undefined) m[s.inPlayerId] = { dir: "in", min: s.minute };
      if (s.outPlayerId && m[s.outPlayerId] === undefined) m[s.outPlayerId] = { dir: "out", min: s.minute };
    }
    return m;
  }, [subs]);

  // POG: 총평 기준
  const totalPlayers = applyAgg(rawPlayers, agg, "full");
  const rated = totalPlayers.filter(p => p.avg !== null);
  rated.sort((a, b) => (b.avg! - a.avg!) || (b.count - a.count));
  const pog = rated[0] || null;

  return (
    <div>
      {/* 스코어보드 (라이트) */}
      <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4 sm:p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <StatusBadge status={match.status} />
          <div className="flex items-center gap-2">
            <ShareButton
              title={`${match.homeTeam} ${match.homeScore ?? "-"} : ${match.awayScore ?? "-"} ${match.awayTeam} 팬 평점`}
              text="fanarena.kr에서 선수 평점을 매겨보세요!"
              path={`/${match.sport}/${match.id}`}
              label="공유" />
            <DeleteMatchButton matchId={match.id} afterDelete={() => router.push("/")} />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 text-center min-w-0">
            <div className="text-sm sm:text-base font-bold text-gray-900 truncate">{match.homeTeam}</div>
            <div className="text-[10px] text-gray-400 tracking-widest mt-1">HOME</div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 font-black text-3xl sm:text-4xl tracking-wide shrink-0">
            <span className={scoreWin(match.homeScore, match.awayScore)}>{match.homeScore ?? "-"}</span>
            <span className="text-xl text-gray-300">:</span>
            <span className={scoreWin(match.awayScore, match.homeScore)}>{match.awayScore ?? "-"}</span>
          </div>
          <div className="flex-1 text-center min-w-0">
            <div className="text-sm sm:text-base font-bold text-gray-900 truncate">{match.awayTeam}</div>
            <div className="text-[10px] text-gray-400 tracking-widest mt-1">AWAY</div>
          </div>
        </div>
        <div className="text-center text-[11px] text-gray-400 mt-3">
          {new Date(match.date).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
        </div>
      </div>

      {isAdmin && <StatusSwitcher matchId={match.id} status={match.status} onChanged={() => router.refresh()} />}

      {isAdmin && (
        <ScoreEditor matchId={match.id} homeTeam={match.homeTeam} awayTeam={match.awayTeam}
          homeScore={match.homeScore} awayScore={match.awayScore} onChanged={() => router.refresh()} />
      )}

      <MatchRecord matchId={match.id} record={match.record} />

      {match.status === "finished" && (match.seed || isAdmin) && (
        <SeedBanner matchId={match.id} seed={match.seed} isAdmin={isAdmin}
          loggedIn={!!session} onChanged={() => router.refresh()} />
      )}
      {isAdmin && match.sport === "kleague" && (
        <button onClick={regenSeed}
          className="text-xs px-2 py-1 mb-4 border rounded bg-white text-gray-500 hover:bg-gray-50">
          🔄 토론거리 자동 생성/갱신
        </button>
      )}

      {pog && (
        <div className="bg-yellow-50 border border-yellow-300 rounded p-3 mb-4">
          🏆 <b>MOM</b>: {pog.name} ({pog.team}) — 평균 {pog.avg}{pog.count >= 100 ? ` / ${pog.count}명 참여` : ""}
        </div>
      )}

      {seg !== "mine" && (
        <StatsPanel players={fieldPlayers} homeTeam={match.homeTeam} awayTeam={match.awayTeam}
          segLabel={segments.find(s => s.key === seg)?.label ?? ""} />
      )}

      {(segments.length > 1 || session) && (
        <div className="flex gap-1 mb-4 border-b overflow-x-auto">
          {segments.map(s => (
            <button key={s.key} onClick={() => setSeg(s.key)}
              className={`px-4 py-2 whitespace-nowrap ${seg===s.key?"border-b-2 border-blue-600 font-semibold text-blue-600":""}`}>
              {s.label}
            </button>
          ))}
          {session && (
            <button onClick={() => setSeg("mine")}
              className={`px-4 py-2 whitespace-nowrap ${seg==="mine"?"border-b-2 border-blue-600 font-semibold text-blue-600":""}`}>
              ⭐ 나의 평점
            </button>
          )}
        </div>
      )}

      {isMine && (
        <MyRatingsHeader matchId={match.id} match={match} />
      )}

      {seg !== "mine" && (
      <div className="mb-4 flex gap-2 justify-end">
        {match.sport === "kbo" && (
          <button onClick={() => setShowAll(!showAll)} className="text-sm px-3 py-1 border rounded bg-white">
            {showAll ? "우선 선수만" : `전체 선수 보기 (${players.length}명)`}
          </button>
        )}
        {isAdmin && (
          <button onClick={() => setAddOpen(true)} className="text-sm px-3 py-1 border rounded bg-blue-50 text-blue-700">
            + 선수 추가
          </button>
        )}
        {isAdmin && match.sport === "kleague" && (
          <button onClick={() => setManageOpen(!manageOpen)}
            className="text-sm px-3 py-1 border rounded bg-amber-50 text-amber-700">
            ⚙️ 전/후반 명단 관리
          </button>
        )}
        {isAdmin && match.sport === "kleague" && (
          <button onClick={() => setSubOpen(!subOpen)}
            className="text-sm px-3 py-1 border rounded bg-amber-50 text-amber-700">
            🔁 교체 정보 입력
          </button>
        )}
        {isAdmin && match.sport === "kleague" && (
          <button onClick={() => setEditPos(!editPos)}
            className={`text-sm px-3 py-1 border rounded ${editPos ? "bg-amber-500 text-white border-amber-500" : "bg-amber-50 text-amber-700"}`}>
            {editPos ? "✓ 위치 편집 종료" : "✋ 선수 위치 편집"}
          </button>
        )}
        {isAdmin && match.sport === "kleague" && editPos && (
          <button onClick={resetPositions}
            className="text-sm px-3 py-1 border rounded bg-white text-gray-600">
            ↺ 위치 초기화
          </button>
        )}
      </div>
      )}

      {manageOpen && isAdmin && seg !== "mine" && (
        <LineupManager players={players} onChanged={() => router.refresh()} />
      )}

      {subOpen && isAdmin && (
        <SubstitutionEditor matchId={match.id} players={rawPlayers}
          homeTeam={match.homeTeam} awayTeam={match.awayTeam}
          onChanged={() => router.refresh()} />
      )}

      <div className="mb-6">
        {match.sport === "kbo" && (
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2">🏠 {match.homeTeam}</h3>
              <BaseballField players={home} onPick={setOpen}/>
            </div>
            <div>
              <h3 className="font-semibold mb-2">✈️ {match.awayTeam}</h3>
              <BaseballField players={away} onPick={setOpen}/>
            </div>
          </div>
        )}
        {match.sport === "kleague" && (
          <SoccerField key={seg} home={home} away={away}
            homeStaff={homeStaff} awayStaff={awayStaff} officials={officials}
            homeTeam={match.homeTeam} awayTeam={match.awayTeam}
            flip={seg === "second"} /* 후반: 진영 반대 (총평은 전반 기준 유지) */
            onPick={setOpen}
            subs={subs} subInfo={subInfo} seg={seg}
            editMode={editPos && isAdmin && seg !== "mine"}
            onMove={savePosition}/>
        )}
        {match.sport === "lck" && (
          <LckLineup home={home} away={away} homeTeam={match.homeTeam} awayTeam={match.awayTeam} onPick={setOpen}/>
        )}
      </div>

      {/* 평점 리스트 (캡처용) — 축구만, 현재 탭 기준 */}
      {match.sport === "kleague" && (home.length > 0 || away.length > 0) && (
        <RatingList home={home} away={away} homeTeam={match.homeTeam} awayTeam={match.awayTeam}
          isMine={isMine} pog={pog} onPick={setOpen} subInfo={subInfo} />
      )}

      {open && <PlayerModal matchId={match.id} player={open} loggedIn={!!session} segment={seg}
        segments={segments} status={match.status} sport={match.sport}
        onClose={() => { setOpen(null); router.refresh(); }}/>}

      {addOpen && <AddPlayerModal matchId={match.id} homeTeam={match.homeTeam} awayTeam={match.awayTeam}
        onClose={() => { setAddOpen(false); router.refresh(); }}/>}
    </div>
  );
}

// 관리자: 교체 정보 입력
function SubstitutionEditor({ matchId, players, homeTeam, awayTeam, onChanged }:
  { matchId: string; players: Player[]; homeTeam: string; awayTeam: string; onChanged: () => void }) {
  type Row = { minute: string; outPlayerId: string; inPlayerId: string };
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // 선수 옵션 (playerId 기준, 중복 제거)
  const opts = useMemo(() => {
    const seen = new Set<string>();
    const list: { id: string; label: string }[] = [];
    for (const p of players) {
      if (seen.has(p.playerId)) continue;
      seen.add(p.playerId);
      const side = p.team === homeTeam ? "🔵" : p.team === awayTeam ? "🔴" : "";
      list.push({ id: p.playerId, label: `${side} ${p.name}` });
    }
    return list;
  }, [players, homeTeam, awayTeam]);

  useEffect(() => {
    fetch(`/api/substitution/${matchId}`).then(r => r.json()).then((subs: any[]) => {
      setRows(subs.map(s => ({ minute: String(s.minute), outPlayerId: s.outPlayerId, inPlayerId: s.inPlayerId })));
    }).catch(() => {});
  }, [matchId]);

  const add = () => setRows([...rows, { minute: "", outPlayerId: "", inPlayerId: "" }]);
  const del = (i: number) => setRows(rows.filter((_, x) => x !== i));
  const upd = (i: number, k: keyof Row, v: string) =>
    setRows(rows.map((r, x) => x === i ? { ...r, [k]: v } : r));

  async function save() {
    setBusy(true); setMsg("");
    const res = await fetch(`/api/substitution/${matchId}`, {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ subs: rows.map(r => ({ minute: Number(r.minute) || 0, outPlayerId: r.outPlayerId, inPlayerId: r.inPlayerId })) }),
    });
    setBusy(false);
    if (!res.ok) { setMsg("저장 실패"); return; }
    setMsg("저장 완료!");
    onChanged();
  }

  return (
    <div className="mb-4 bg-amber-50/60 border border-amber-200 rounded-xl p-3.5">
      <h3 className="text-sm font-bold text-amber-800 mb-0.5">🔁 교체 정보 입력</h3>
      <p className="text-[11px] text-amber-600 mb-3">"분 · 나간 선수(OUT) → 들어온 선수(IN)"를 등록하면 마커·리스트에 교체 표시가 나타납니다.</p>

      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-1.5 mb-2 flex-wrap">
          <input value={r.minute} onChange={e => upd(i, "minute", e.target.value)}
            inputMode="numeric" placeholder="분" className="w-12 border rounded px-2 py-1.5 text-sm text-center" />
          <span className="text-[11px] text-gray-400">분</span>
          <select value={r.outPlayerId} onChange={e => upd(i, "outPlayerId", e.target.value)}
            className="flex-1 min-w-[100px] border rounded px-2 py-1.5 text-sm bg-white">
            <option value="">나간 선수(OUT)</option>
            {opts.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <span className="text-green-600 font-extrabold">→</span>
          <select value={r.inPlayerId} onChange={e => upd(i, "inPlayerId", e.target.value)}
            className="flex-1 min-w-[100px] border rounded px-2 py-1.5 text-sm bg-white">
            <option value="">들어온 선수(IN)</option>
            {opts.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <button onClick={() => del(i)} className="text-red-500 font-bold px-1.5">✕</button>
        </div>
      ))}

      <div className="flex items-center gap-3 mt-2">
        <button onClick={add} className="text-sm text-blue-600 font-semibold">+ 교체 추가</button>
        {msg && <span className="text-xs text-amber-700">{msg}</span>}
        <button onClick={save} disabled={busy}
          className="ml-auto text-sm px-4 py-1.5 rounded-lg bg-amber-600 text-white font-semibold disabled:opacity-40">
          {busy ? "저장중" : "교체 정보 저장"}
        </button>
      </div>
    </div>
  );
}

// 포지션 코드 → 4그룹(GK/DF/MF/FW)
function posGroup(role: string | undefined): "GK" | "DF" | "MF" | "FW" | null {
  const code = normalizeRole(role);
  const line = code ? POSITION_MAP[code]?.line : null;
  if (!line) return null;
  if (line === "GK" || line === "SW") return "GK";
  if (line === "DEF") return "DF";
  if (line === "DM" || line === "MID" || line === "AM") return "MF";
  return "FW"; // FW, SS, ST
}
const GROUP_LABEL: Record<string, string> = { GK: "GK · 골키퍼", DF: "DF · 수비수", MF: "MF · 미드필더", FW: "FW · 공격수" };
const GROUP_ICON: Record<string, string> = { GK: "🧤", DF: "🛡️", MF: "⚙️", FW: "🎯" };
const GROUP_ORDER = ["GK", "DF", "MF", "FW"] as const;

// 평점 리스트 (높은순 / 낮은순 / 포지션 비교)
function RatingList({ home, away, homeTeam, awayTeam, isMine, pog, onPick, subInfo = {} }:
  { home: Player[]; away: Player[]; homeTeam: string; awayTeam: string;
    isMine: boolean; pog: Player | null; onPick: (p: Player) => void;
    subInfo?: Record<string, { dir: "in" | "out"; min: number }> }) {
  const [mode, setMode] = useState<"high" | "low" | "pos">("high");
  const all = [...home, ...away];

  // 정렬 리스트 (평점 있는 선수만)
  const ratedSorted = all.filter(p => p.avg !== null)
    .sort((a, b) => mode === "low" ? (a.avg! - b.avg!) : (b.avg! - a.avg!));

  // 교체 배지 (→들어옴 / ←나감 + 분)
  function SubBadge({ pid }: { pid: string }) {
    const s = subInfo[pid];
    if (!s) return null;
    return (
      <span className={`text-[9px] font-extrabold text-white rounded px-1 py-0.5 ${s.dir === "in" ? "bg-green-600" : "bg-red-500"}`}>
        {s.dir === "in" ? "→" : "←"}{s.min}{"'"}
      </span>
    );
  }

  function Row({ p, rank }: { p: Player; rank: number }) {
    const isHome = p.team === homeTeam;
    const v = p.avg!;
    // 순위 메달색 (높은순 1~3위만)
    const medal = mode === "high" && rank <= 3;
    const rkClass = !medal ? "text-gray-300"
      : rank === 1 ? "bg-amber-400 text-white" : rank === 2 ? "bg-gray-400 text-white" : "bg-amber-700/70 text-white";
    // 점수 배지색
    const worst = mode === "low" && rank === 1;
    const best = mode === "high" && rank === 1;
    const scClass = best ? "bg-amber-400 text-white shadow-md shadow-amber-400/40"
      : worst ? "bg-red-500 text-white shadow-md shadow-red-500/40"
      : v < 4 ? "bg-red-50 text-red-500"
      : v >= 7 ? "bg-green-50 text-green-600"
      : "bg-gray-100 text-gray-700";
    return (
      <button onClick={() => onPick(p)}
        className="w-full flex items-center gap-2.5 px-3 py-2 border-t border-gray-50 first:border-t-0 hover:bg-gray-50 text-left">
        <span className={`w-6 h-6 shrink-0 flex items-center justify-center text-[13px] font-extrabold rounded-lg ${rkClass}`}>{rank}</span>
        <span className={`w-1 self-stretch rounded-full shrink-0 ${isHome ? "bg-blue-500" : "bg-red-500"}`} />
        <span className="flex-1 min-w-0 flex items-center gap-1.5">
          <span className="text-[14.5px] font-bold text-gray-900 truncate">{p.name}</span>
          {p.role && <span className="text-[10px] font-bold text-gray-400 bg-gray-100 rounded px-1 py-px shrink-0">{p.role}</span>}
          <SubBadge pid={p.playerId} />
        </span>
        <span className={`w-11 h-9 shrink-0 flex items-center justify-center text-[15px] font-extrabold rounded-[10px] ${scClass}`}>{v}</span>
      </button>
    );
  }

  // 포지션 비교: 그룹별로 양 팀 평점 높은 순 나란히 (가시성 개선)
  function posCompare() {
    const sortByAvg = (a: Player, b: Player) => (b.avg ?? -1) - (a.avg ?? -1);

    // 한쪽 셀 렌더
    const Cell = ({ p, side, win }: { p?: Player; side: "home" | "away"; win: boolean }) => {
      const rated = p && p.avg !== null;
      const isHome = side === "home";
      const base = `flex-1 relative flex items-center gap-2 px-3 py-2.5 overflow-hidden ${isHome ? "justify-end" : "flex-row-reverse justify-end"}`;
      if (!p) return <div className={base}><span className="text-[13px] text-gray-300 italic">—</span></div>;
      return (
        <button onClick={() => onPick(p)} className={base}>
          {win && (
            <span className={`absolute inset-y-0 w-2/3 opacity-[0.13] ${isHome
              ? "right-0 bg-gradient-to-l from-blue-500 to-transparent"
              : "left-0 bg-gradient-to-r from-red-500 to-transparent"}`} />
          )}
          <span className={`relative z-10 text-[13.5px] truncate max-w-[88px] ${
            win ? (isHome ? "font-extrabold text-blue-700" : "font-extrabold text-red-600") : "font-semibold text-gray-700"}`}>{p.name}</span>
          <span className={`relative z-10 w-9 h-9 rounded-[11px] flex items-center justify-center text-[13px] font-extrabold shrink-0 ${
            win ? (isHome ? "bg-blue-500 text-white shadow-md shadow-blue-500/40" : "bg-red-500 text-white shadow-md shadow-red-500/40")
                : rated ? "bg-gray-100 text-gray-700" : "bg-gray-50 text-gray-300"}`}>
            {rated ? p.avg : "–"}
          </span>
        </button>
      );
    };

    return GROUP_ORDER.map(g => {
      const h = home.filter(p => posGroup(p.role) === g).sort(sortByAvg);
      const a = away.filter(p => posGroup(p.role) === g).sort(sortByAvg);
      const rows = Math.max(h.length, a.length);
      if (rows === 0) return null;
      return (
        <div key={g}>
          <div className="flex items-center gap-1.5 bg-gray-100 text-[11px] font-extrabold text-gray-500 px-3.5 py-1.5 border-t border-gray-200">
            <span>{GROUP_ICON[g]}</span>{GROUP_LABEL[g]}
          </div>
          {Array.from({ length: rows }).map((_, i) => {
            const ph = h[i], pa = a[i];
            const hv = ph?.avg ?? null, av = pa?.avg ?? null;
            const hWin = hv !== null && av !== null && hv > av;
            const aWin = hv !== null && av !== null && av > hv;
            const bothEmpty = hv === null && av === null;
            return (
              <div key={i} className={`flex items-stretch border-t border-gray-50 min-h-[52px] ${bothEmpty ? "opacity-50" : ""}`}>
                <Cell p={ph} side="home" win={hWin} />
                <div className="w-8 shrink-0 flex items-center justify-center border-x border-gray-100">
                  <span className="text-[12px]">{hWin || aWin ? "👑" : <span className="text-[8px] font-extrabold text-gray-300">VS</span>}</span>
                </div>
                <Cell p={pa} side="away" win={aWin} />
              </div>
            );
          })}
        </div>
      );
    });
  }

  const btn = (k: "high" | "low" | "pos", label: string) => (
    <button onClick={() => setMode(k)}
      className={`flex-1 text-[12px] font-bold py-2 rounded-lg border transition ${
        mode === k ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-200 text-gray-500"}`}>
      {label}
    </button>
  );

  return (
    <div className="mt-5">
      <div className="flex gap-1.5 mb-3">
        {btn("high", "평점 높은순")}
        {btn("low", "평점 낮은순")}
        {btn("pos", "포지션 비교")}
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-gray-100">
          <span className="text-[13px] font-extrabold text-gray-900">📊 평점 {mode === "pos" ? "포지션 비교" : "순위"}</span>
          <span className="text-[11px] text-gray-400 font-semibold">{isMine ? "나의 평점" : "총평"}{mode === "low" ? " · 낮은 순" : mode === "high" ? " · 높은 순" : ""}</span>
        </div>

        {mode === "pos" && (
          <div className="flex items-center bg-gray-900 text-white px-3.5 py-2.5">
            <div className="flex-1 flex items-center gap-1.5 text-[13px] font-extrabold">
              <span className="w-2 h-2 rounded-full bg-blue-500" />{homeTeam}
            </div>
            <span className="text-[10px] font-bold text-gray-400 px-2">VS</span>
            <div className="flex-1 flex items-center justify-end gap-1.5 text-[13px] font-extrabold">
              {awayTeam}<span className="w-2 h-2 rounded-full bg-red-500" />
            </div>
          </div>
        )}

        {mode === "pos" ? (
          posCompare()
        ) : ratedSorted.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">아직 평점이 없습니다.</p>
        ) : (
          ratedSorted.map((p, i) => <Row key={p.mpId} p={p} rank={i + 1} />)
        )}

        {/* 캡처용 푸터 */}
        <div className="flex items-center justify-center gap-2 bg-gray-900 text-white text-[12px] font-semibold py-2.5">
          {mode === "low"
            ? (ratedSorted[0] && <span>⚠️ WORST {ratedSorted[0].name} {ratedSorted[0].avg}</span>)
            : (pog && <span>🏆 MOM {pog.name} {pog.avg}</span>)}
          <span className="text-gray-500">·</span>
          <span>fanarena<span className="text-gray-400">.kr</span></span>
        </div>
      </div>
    </div>
  );
}

// 관리자: 선수별 전/후반 출전 구성 변경 + 명단 제거
function LineupManager({ players, onChanged }: { players: Player[]; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const SEGS = [
    { key: "all", label: "전·후반" },
    { key: "first", label: "전반" },
    { key: "second", label: "후반" },
  ];

  async function setSegment(p: Player, segment: string) {
    setBusy(p.mpId);
    const res = await fetch(`/api/match-player/${p.mpId}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ segment }),
    });
    setBusy(null);
    if (!res.ok) { alert("변경 실패"); return; }
    onChanged();
  }

  async function setStarter(p: Player, isDefault: boolean) {
    setBusy(p.mpId);
    const res = await fetch(`/api/match-player/${p.mpId}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ isDefault }),
    });
    setBusy(null);
    if (!res.ok) { alert("변경 실패"); return; }
    onChanged();
  }

  async function remove(p: Player) {
    if (!confirm(`${p.name} 선수를 명단에서 제거할까요? 이 경기의 해당 선수 평점도 삭제됩니다.`)) return;
    setBusy(p.mpId);
    const res = await fetch(`/api/match-player/${p.mpId}`, { method: "DELETE" });
    setBusy(null);
    if (!res.ok) { alert("제거 실패"); return; }
    onChanged();
  }

  const byTeam: Record<string, Player[]> = {};
  for (const p of players) (byTeam[p.team] ||= []).push(p);

  return (
    <div className="border rounded-lg bg-amber-50/50 p-3 mb-4 text-sm">
      <p className="font-semibold mb-2">⚙️ 명단 관리 <span className="font-normal text-xs text-gray-500">— 선발/후보와 출전 구간을 바꿀 수 있습니다</span></p>
      {Object.keys(byTeam).map(team => {
        const starters = byTeam[team].filter(p => p.isDefault !== false).length;
        return (
        <div key={team} className="mb-3">
          <p className="text-xs font-semibold text-gray-500 mb-1">{team} <span className="text-gray-400">· 선발 {starters}명</span></p>
          <div className="space-y-1">
            {byTeam[team].map(p => {
              const isStarter = p.isDefault !== false;
              return (
              <div key={p.mpId} className="flex items-center gap-2 bg-white border rounded px-2 py-1.5">
                <span className="flex-1 truncate min-w-0">{p.name} <span className="text-xs text-gray-400">{p.role}</span></span>
                {/* 선발/후보 토글 */}
                <div className="flex rounded overflow-hidden border shrink-0">
                  <button disabled={busy === p.mpId} onClick={() => setStarter(p, true)}
                    className={`px-2 py-0.5 text-xs ${isStarter ? "bg-green-600 text-white" : "bg-white hover:bg-gray-50"}`}>선발</button>
                  <button disabled={busy === p.mpId} onClick={() => setStarter(p, false)}
                    className={`px-2 py-0.5 text-xs ${!isStarter ? "bg-gray-700 text-white" : "bg-white hover:bg-gray-50"}`}>후보</button>
                </div>
                <div className="flex rounded overflow-hidden border shrink-0">
                  {SEGS.map(s => (
                    <button key={s.key} disabled={busy === p.mpId}
                      onClick={() => setSegment(p, s.key)}
                      className={`px-2 py-0.5 text-xs ${ (p.segment || "all") === s.key
                        ? "bg-blue-600 text-white" : "bg-white hover:bg-gray-50"}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
                <button disabled={busy === p.mpId} onClick={() => remove(p)}
                  className="text-xs text-red-500 hover:underline shrink-0">제거</button>
              </div>
              );
            })}
          </div>
        </div>
        );
      })}
    </div>
  );
}

function StatusBadge({ status, dark = false }: { status: string; dark?: boolean }) {
  const light: Record<string, { label: string; cls: string }> = {
    scheduled: { label: "예정", cls: "bg-gray-100 text-gray-600" },
    live: { label: "진행중", cls: "bg-red-100 text-red-600" },
    finished: { label: "종료", cls: "bg-blue-100 text-blue-700" },
  };
  const darkMap: Record<string, { label: string; cls: string; live?: boolean }> = {
    scheduled: { label: "예정", cls: "border border-[#39415a] text-[#9aa6bd]" },
    live: { label: "진행중", cls: "bg-[rgba(255,90,90,.16)] text-[#ff8585]", live: true },
    finished: { label: "종료", cls: "bg-[#2a3040] text-[#9aa6bd]" },
  };
  if (dark) {
    const s = darkMap[status] ?? darkMap.scheduled;
    return (
      <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${s.cls}`}>
        {s.live && <span className="w-1.5 h-1.5 rounded-full bg-[#ff5a5a] animate-pulse" />}
        {s.label}
      </span>
    );
  }
  const s = light[status] ?? light.scheduled;
  return <span className={`ml-2 text-xs px-2 py-0.5 rounded-full align-middle ${s.cls}`}>{s.label}</span>;
}

// 이긴 팀 점수는 파란색, 진 팀/무승부는 회색
function scoreWin(mine: number | null, other: number | null): string {
  if (mine == null || other == null) return "text-gray-300";
  return mine > other ? "text-blue-600" : "text-gray-300";
}

// 관리자: 경기 진행 상태 변경 (예정 → 진행중 → 종료)
function ScoreEditor({ matchId, homeTeam, awayTeam, homeScore, awayScore, onChanged }:
  { matchId: string; homeTeam: string; awayTeam: string;
    homeScore: number | null; awayScore: number | null; onChanged: () => void }) {
  const [h, setH] = useState<string>(homeScore?.toString() ?? "");
  const [a, setA] = useState<string>(awayScore?.toString() ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    await fetch(`/api/admin/match/${matchId}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        homeScore: h === "" ? null : Number(h),
        awayScore: a === "" ? null : Number(a),
      }),
    });
    setBusy(false);
    onChanged();
  }

  const changed = h !== (homeScore?.toString() ?? "") || a !== (awayScore?.toString() ?? "");

  return (
    <div className="flex items-center gap-2 mb-3 text-sm bg-gray-50 border rounded px-3 py-2">
      <span className="text-gray-500 text-xs">스코어</span>
      <span className="font-medium">{homeTeam}</span>
      <input type="number" min={0} max={99} value={h} onChange={e => setH(e.target.value)}
        className="w-12 border rounded px-1 py-0.5 text-center" placeholder="-" />
      <span className="text-gray-400">:</span>
      <input type="number" min={0} max={99} value={a} onChange={e => setA(e.target.value)}
        className="w-12 border rounded px-1 py-0.5 text-center" placeholder="-" />
      <span className="font-medium">{awayTeam}</span>
      <button onClick={save} disabled={busy || !changed}
        className="ml-auto text-xs px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-40">
        {busy ? "저장중" : "저장"}
      </button>
    </div>
  );
}

function StatusSwitcher({ matchId, status, onChanged }:
  { matchId: string; status: string; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const OPTS = [
    { key: "scheduled", label: "예정" },
    { key: "live", label: "진행중" },
    { key: "finished", label: "종료" },
  ];
  async function setStatus(s: string) {
    if (s === status) return;
    setBusy(true);
    const res = await fetch(`/api/admin/match/${matchId}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: s }),
    });
    setBusy(false);
    if (!res.ok) { alert("상태 변경 실패"); return; }
    onChanged();
  }
  return (
    <div className="flex items-center gap-2 mb-4 text-sm">
      <span className="text-gray-500 text-xs">경기 상태:</span>
      <div className="flex rounded overflow-hidden border">
        {OPTS.map(o => (
          <button key={o.key} disabled={busy} onClick={() => setStatus(o.key)}
            className={`px-3 py-1 text-xs ${status === o.key ? "bg-blue-600 text-white" : "bg-white hover:bg-gray-50"}`}>
            {o.label}
          </button>
        ))}
      </div>
      <span className="text-xs text-gray-400">진행중=전반/1세트만, 종료=전 구간 평점 가능</span>
    </div>
  );
}

// 평점 통계: 선수 순위 막대 + 팀별 평균 비교
function StatsPanel({ players, homeTeam, awayTeam, segLabel }:
  { players: Player[]; homeTeam: string; awayTeam: string; segLabel: string }) {
  const [open, setOpen] = useState(false);

  const rated = players.filter(p => p.avg !== null) as (Player & { avg: number })[];

  // 팀 평균 (평점이 매겨진 선수 기준)
  const teamAvg = (team: string) => {
    const list = rated.filter(p => p.team === team);
    if (list.length === 0) return null;
    const sum = list.reduce((a, p) => a + p.avg, 0);
    return { avg: Number((sum / list.length).toFixed(2)), n: list.length };
  };
  const homeA = teamAvg(homeTeam);
  const awayA = teamAvg(awayTeam);

  // 선수 순위 (베스트 → 워스트)
  const ranked = [...rated].sort((a, b) => b.avg - a.avg || b.count - a.count);

  // 팀 기준 색상 (홈=파랑, 원정=빨강 — 팀 평균 막대와 통일)
  const teamColor = (team: string) =>
    team === homeTeam ? "bg-blue-500" : team === awayTeam ? "bg-red-500" : "bg-gray-400";
  const pct = (v: number) => `${Math.max(0, Math.min(100, ((v - 1) / 9) * 100))}%`; // 1~10 범위를 0~100%로

  if (rated.length === 0) return null;

  return (
    <div className="mb-4 border rounded-lg bg-white overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex justify-between items-center px-4 py-2.5 text-sm font-semibold hover:bg-gray-50">
        <span>📊 평점 통계{segLabel ? ` · ${segLabel}` : ""}</span>
        <span className="text-gray-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-5">
          {/* 팀별 평균 비교 */}
          {(homeA || awayA) && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">팀 평균 평점</p>
              <div className="space-y-2">
                {[{ t: homeTeam, d: homeA, c: "bg-blue-500" }, { t: awayTeam, d: awayA, c: "bg-red-500" }].map(({ t, d, c }) => (
                  <div key={t} className="flex items-center gap-2">
                    <span className="w-20 shrink-0 text-xs truncate">{t}</span>
                    <div className="flex-1 bg-gray-100 rounded h-5 relative">
                      {d && <div className={`${c} h-5 rounded flex items-center justify-end pr-1.5`} style={{ width: pct(d.avg) }}>
                        <span className="text-[10px] text-white font-bold">{d.avg}</span>
                      </div>}
                    </div>
                    <span className="w-10 shrink-0 text-[10px] text-gray-400 text-right">{d ? `${d.n}명` : "-"}</span>
                  </div>
                ))}
              </div>
              {homeA && awayA && (
                <p className="text-xs text-gray-500 mt-1.5 text-center">
                  {homeA.avg > awayA.avg ? `${homeTeam}` : awayA.avg > homeA.avg ? `${awayTeam}` : "양 팀"}
                  {homeA.avg === awayA.avg ? " 평점 동일" : ` 우세 (+${Math.abs(homeA.avg - awayA.avg).toFixed(2)})`}
                </p>
              )}
            </div>
          )}

          {/* 선수 순위 막대 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500">선수 평점 순위 (베스트 → 워스트)</p>
              <div className="flex gap-2 text-[10px] text-gray-400">
                <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" />{homeTeam}</span>
                <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" />{awayTeam}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              {ranked.map((p, i) => (
                <div key={p.mpId} className="flex items-center gap-2">
                  <span className="w-4 shrink-0 text-[10px] text-gray-400 text-right">{i + 1}</span>
                  <span className="w-16 shrink-0 text-xs truncate">{p.name}</span>
                  <div className="flex-1 bg-gray-100 rounded h-5">
                    <div className={`${teamColor(p.team)} h-5 rounded flex items-center justify-end pr-1.5`} style={{ width: pct(p.avg) }}>
                      <span className="text-[10px] text-white font-bold">{p.avg}</span>
                    </div>
                  </div>
                  <span className="w-8 shrink-0 text-[10px] text-gray-400 text-right">{p.count}명</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 나의 평점 탭 헤더: 내 평균 + 공유 버튼 (점수는 피치/필드 위에 표시됨)
function MyRatingsHeader({ matchId, match }: { matchId: string; match: any }) {
  const [data, setData] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/my-ratings?matchId=${matchId}`).then(r => r.json()).then(setData).catch(() => {});
  }, [matchId]);

  if (data && !data.loggedIn)
    return <p className="text-sm text-gray-500 mb-4">로그인 후 이용할 수 있습니다.</p>;

  const count = data?.count ?? 0;

  async function share() {
    if (!data?.userId) return;
    const shareUrl = `${window.location.origin}/me/${matchId}/${data.userId}`;
    const text = `${data.nickname}님의 평점 (평균 ⭐${data.avg}) · ${match.homeTeam} ${match.homeScore ?? "-"}:${match.awayScore ?? "-"} ${match.awayTeam}`;
    if ((navigator as any).share) {
      try { await (navigator as any).share({ title: "내 평점 · fanarena.kr", text, url: shareUrl }); return; } catch { return; }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true); setTimeout(() => setCopied(false), 1800);
    } catch {
      prompt("아래 링크를 복사하세요:", shareUrl);
    }
  }

  return (
    <div className="flex items-center justify-between mb-3 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
      <p className="text-sm font-semibold text-blue-800">
        ⭐ 나의 평점
        {count > 0 && data?.top
          ? <span className="font-normal text-blue-600"> · 내 최고 평점 <b className="text-blue-800">{data.top.name}</b> ⭐{data.top.score}</span>
          : count > 0
          ? <span className="font-normal text-blue-600"> · {count}명 평가</span>
          : <span className="font-normal text-blue-500"> · 선수를 눌러 평점을 남겨보세요</span>}
      </p>
      {count > 0 && (
        <button onClick={share} className="text-sm px-3 py-1.5 rounded bg-blue-600 text-white shrink-0">
          {copied ? "✓ 복사됨" : "🔗 공유"}
        </button>
      )}
    </div>
  );
}

// 경기 토론 댓글창 (시드 배너 아래)
// 토론 주제(시드) 배너 — 관리자는 직접 수정 가능
function SeedBanner({ matchId, seed, isAdmin, loggedIn, onChanged }:
  { matchId: string; seed: string | null; isAdmin: boolean; loggedIn: boolean; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(seed || "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    await fetch(`/api/admin/match/${matchId}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ seed: text }),
    });
    setBusy(false);
    setEditing(false);
    onChanged();
  }

  // 시드도 없고 편집 중도 아니면 (관리자에게만) 추가 버튼
  if (!seed && !editing) {
    if (!isAdmin) return null;
    return (
      <div className="mb-4">
        <button onClick={() => { setText(""); setEditing(true); }}
          className="text-xs px-2 py-1 border rounded bg-white text-orange-600 hover:bg-orange-50">
          ✏️ 토론 주제 직접 입력
        </button>
      </div>
    );
  }

  return (
    <div className="bg-orange-50 border border-orange-300 rounded-lg p-3 mb-4">
      {editing ? (
        <div className="space-y-2">
          <textarea value={text} onChange={e => setText(e.target.value)} maxLength={300}
            placeholder="토론 주제를 입력하세요 (비우면 삭제됩니다)"
            className="w-full border rounded p-2 text-sm h-20 bg-white" />
          <div className="flex gap-2 justify-end">
            <span className="text-[11px] text-orange-400 mr-auto self-center">{text.length}/300</span>
            <button onClick={() => { setText(seed || ""); setEditing(false); }}
              className="text-xs px-3 py-1 border rounded bg-white">취소</button>
            <button onClick={save} disabled={busy}
              className="text-xs px-3 py-1 rounded bg-orange-500 text-white disabled:opacity-40">저장</button>
          </div>
        </div>
      ) : (
        <div className="flex justify-between items-start gap-2">
          <p className="text-sm text-orange-900 font-medium">{seed}</p>
          {isAdmin && (
            <button onClick={() => { setText(seed || ""); setEditing(true); }}
              className="text-[11px] text-orange-500 shrink-0 hover:underline">✏️ 수정</button>
          )}
        </div>
      )}
      {seed && !editing && <DiscussionThread matchId={matchId} loggedIn={loggedIn} />}
    </div>
  );
}

function DiscussionThread({ matchId, loggedIn }: { matchId: string; loggedIn: boolean }) {
  const [items, setItems] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(true);
  const [replyOn, setReplyOn] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  async function load() {
    const res = await fetch(`/api/discussion/${matchId}`);
    if (res.ok) { const j = await res.json(); setItems(j.items || []); setIsAdmin(!!j.isAdmin); }
  }
  useEffect(() => { load(); }, [matchId]);

  async function submit() {
    const t = text.trim();
    if (!t) return;
    setBusy(true);
    const res = await fetch(`/api/discussion/${matchId}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: t }),
    });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { alert(j.error || "등록 실패"); return; }
    setText(""); load();
  }

  async function submitReply(commentId: string) {
    const t = replyText.trim();
    if (!t) return;
    const res = await fetch(`/api/discussion/comment/${commentId}/reply`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: t }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { alert(j.error || "등록 실패"); return; }
    setReplyText(""); setReplyOn(null); load();
  }

  async function like(id: string) {
    if (!loggedIn) { alert("로그인이 필요합니다."); return; }
    await fetch(`/api/discussion/comment/${id}/like`, { method: "POST" });
    load();
  }

  async function report(id: string) {
    if (!loggedIn) { alert("로그인이 필요합니다."); return; }
    const reason = prompt("신고 사유를 입력해주세요 (선택)");
    if (reason === null) return; // 취소
    const res = await fetch(`/api/discussion/comment/${id}/report`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { alert(j.error || "신고 실패"); return; }
    alert("신고가 접수되었습니다.");
    load();
  }

  async function remove(id: string) {
    if (!confirm("이 댓글을 삭제할까요?")) return;
    await fetch(`/api/discussion/comment/${id}`, { method: "DELETE" });
    load();
  }
  async function setBlind(id: string, blinded: boolean) {
    await fetch(`/api/discussion/comment/${id}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ blinded }),
    });
    load();
  }

  return (
    <div className="mt-3 border-t border-orange-200 pt-3">
      <button onClick={() => setOpen(!open)} className="text-xs font-semibold text-orange-700 mb-2">
        💬 토론 {items.length > 0 ? `(${items.length})` : ""} {open ? "▲" : "▼"}
      </button>

      {open && (
        <>
          {/* 입력 */}
          {loggedIn ? (
            <div className="flex gap-1 mb-3">
              <input value={text} onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") submit(); }}
                placeholder="이 경기에 대한 의견을 남겨보세요"
                maxLength={500}
                className="flex-1 border rounded px-2 py-1.5 text-sm bg-white" />
              <button onClick={submit} disabled={busy || !text.trim()}
                className="text-sm px-3 bg-orange-500 text-white rounded disabled:opacity-40">등록</button>
            </div>
          ) : (
            <p className="text-xs text-orange-500 mb-3">로그인하면 토론에 참여할 수 있습니다.</p>
          )}

          {/* 목록 */}
          <div className="space-y-1.5">
            {items.length === 0 && <p className="text-xs text-orange-400">첫 댓글을 남겨보세요!</p>}
            {items.map(c => (
              <div key={c.id} className="bg-white border border-orange-100 rounded px-2.5 py-1.5">
                <div className="flex justify-between items-start gap-2">
                  <span className="text-[11px] text-gray-500">{c.username}</span>
                  <div className="flex gap-2 shrink-0">
                    {isAdmin && (c.blinded
                      ? <button onClick={() => setBlind(c.id, false)} className="text-[10px] text-green-600">복구</button>
                      : <button onClick={() => setBlind(c.id, true)} className="text-[10px] text-amber-600">블라인드</button>)}
                    {(isAdmin || c.mine) && (
                      <button onClick={() => remove(c.id)} className="text-[10px] text-red-400">삭제</button>
                    )}
                  </div>
                </div>

                {c.blinded
                  ? <p className="text-sm text-gray-400 italic">🚫 신고 누적으로 가려진 댓글입니다.</p>
                  : <p className="text-sm whitespace-pre-wrap break-words">{c.text}</p>}

                {/* 액션 바 */}
                {!c.blinded && (
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400">
                    <button onClick={() => like(c.id)} className="hover:text-orange-600">👍 {c.likes > 0 ? c.likes : ""}</button>
                    <button onClick={() => { setReplyOn(replyOn === c.id ? null : c.id); setReplyText(""); }} className="hover:text-orange-600">💬 답글 {c.replies.length > 0 ? c.replies.length : ""}</button>
                    {!c.mine && (
                      <button onClick={() => report(c.id)} className={`hover:text-red-500 ${c.reportedByMe ? "text-red-400" : ""}`}>
                        🚩 {c.reportedByMe ? "신고됨" : "신고"}
                      </button>
                    )}
                  </div>
                )}

                {/* 답글 입력 */}
                {replyOn === c.id && loggedIn && (
                  <div className="flex gap-1 mt-2">
                    <input value={replyText} onChange={e => setReplyText(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") submitReply(c.id); }}
                      placeholder="답글 입력" maxLength={300}
                      className="flex-1 border rounded px-2 py-1 text-xs bg-white" />
                    <button onClick={() => submitReply(c.id)} disabled={!replyText.trim()}
                      className="text-xs px-2 bg-orange-500 text-white rounded disabled:opacity-40">등록</button>
                  </div>
                )}

                {/* 답글 목록 */}
                {c.replies.length > 0 && (
                  <div className="mt-2 space-y-1 pl-3 border-l-2 border-orange-100">
                    {c.replies.map((r: any) => (
                      <div key={r.id} className="text-xs">
                        <span className="text-gray-400">{r.username}</span>{" "}
                        <span className="whitespace-pre-wrap break-words">{r.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MatchRecord({ matchId, record }: { matchId: string; record?: string | null }) {
  const { data: session } = useSession();
  const router = useRouter();
  const isAdmin = (session?.user as any)?.role === "admin";
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(record || "");
  const [saving, setSaving] = useState(false);

  // 기록도 없고 관리자도 아니면 표시하지 않음
  if (!record && !isAdmin) return null;

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/admin/match/${matchId}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ record: text }),
    });
    setSaving(false);
    if (!res.ok) { alert("저장 실패"); return; }
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="bg-white border rounded p-3 mb-4 text-sm max-w-md">
      <div className="flex justify-between items-center mb-1">
        <span className="font-semibold">⚽ 골 · 어시스트 기록</span>
        {isAdmin && !editing && (
          <button onClick={() => { setText(record || ""); setEditing(true); }}
            className="text-xs text-blue-600 hover:underline">{record ? "수정" : "+ 입력"}</button>
        )}
      </div>
      {editing ? (
        <div>
          <textarea value={text} onChange={e => setText(e.target.value)}
            className="w-full border rounded p-2 h-24 text-sm"
            placeholder={"한 줄에 하나씩 입력\n예) 23' 손흥민 (도움: 이강인)\n67' 주민규 (PK)"}/>
          <div className="flex gap-2 justify-end mt-1">
            <button onClick={() => setEditing(false)} className="px-3 py-1 border rounded text-xs">취소</button>
            <button onClick={save} disabled={saving}
              className="px-3 py-1 bg-blue-600 text-white rounded text-xs disabled:opacity-40">저장</button>
          </div>
        </div>
      ) : record ? (
        <ul className="space-y-0.5">
          {record.split("\n").filter(Boolean).map((line, i) => (
            <li key={i} className="text-gray-700">{line}</li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-400 text-xs">아직 기록이 없습니다.</p>
      )}
    </div>
  );
}

function PlayerModal({ matchId, player, loggedIn, segment, segments, status, sport, onClose }:
  { matchId: string; player: Player; loggedIn: boolean; segment: string; segments:{key:string;label:string}[]; status: string; sport: string; onClose: () => void }) {
  const ratableSegs = segments.filter(s => s.key !== "full");

  // 경기 상태에 따른 평점 가능 구간
  // - scheduled(예정): 아직 평점 불가
  // - live(진행중): 첫 구간(전반/1세트)만 가능, 이후 구간 잠금
  // - finished(종료): 모든 구간 가능
  function segLocked(key: string): boolean {
    if (status === "finished") return false;
    if (status === "live") return key !== ratableSegs[0]?.key; // 첫 구간 외 잠금
    return true; // scheduled: 전부 잠금
  }
  const lockMsg =
    status === "scheduled" ? "경기 시작 후 평점을 매길 수 있습니다."
    : status === "live" ? `${ratableSegs[0]?.label ?? "전반"} 진행 중 — 이후 구간은 경기 종료 후 입력할 수 있습니다.`
    : "";

  // 첫 진입 시 입력 가능한 구간으로 자동 선택 ("mine" 탭에서 열면 총평처럼 처리)
  const initialSeg = (() => {
    const normalized = segment === "mine" ? "full" : segment;
    const base = (normalized === "full" || segments.length <= 1) && ratableSegs[0]
      ? (normalized === "full" ? ratableSegs[0].key : normalized)
      : normalized;
    if (status === "live") return ratableSegs[0]?.key ?? base;
    return base;
  })();
  const [seg, setSeg] = useState(initialSeg);
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [msg, setMsg] = useState("");
  const [data, setData] = useState<any>(null);

  async function load() {
    const r = await fetch(`/api/player-ratings?matchId=${matchId}&playerId=${player.playerId}`);
    setData(await r.json());
  }
  useEffect(() => { load(); }, []);

  async function submit() {
    if (score === null) { setMsg("평점을 선택하세요."); return; }
    const res = await fetch("/api/rating", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ matchId, playerId: player.playerId, score, comment, segment: seg }),
    });
    const j = await res.json();
    if (!res.ok) { setMsg(j.error); return; }
    setMsg("등록 완료!");
    setComment(""); setScore(null);
    load();
  }

  async function like(id: string) {
    if (!loggedIn) { alert("로그인이 필요합니다."); return; }
    await fetch(`/api/comment/${id}/like`, { method: "POST" });
    load();
  }

  const top3 = (data?.comments || []).slice(0, 3);
  const rest = (data?.comments || []).slice(3);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b sticky top-0 bg-white flex justify-between">
          <div>
            <h3 className="text-xl font-bold">{player.name}</h3>
            <p className="text-sm text-gray-500">{player.team} · {player.role}</p>
            {data && <p className="text-sm mt-1">전체 평균 ⭐ {data.avg} ({data.count}명)</p>}
          </div>
          <div className="flex items-start gap-2">
            {data && (
              <ShareButton
                title={`${player.name} 팬 평점 ⭐ ${data.avg}`}
                text={`${player.team} ${player.name} — fanarena.kr 팬 평점 ${data.avg}점 (${data.count}명)`}
                path={`/${sport}/${matchId}`}
                label="공유" />
            )}
            <button onClick={onClose} className="text-2xl leading-none">×</button>
          </div>
        </div>

        <div className="p-5 border-b">
          {loggedIn ? (
            <>
              {ratableSegs.length > 1 && (
                <div className="flex gap-1 mb-3 flex-wrap">
                  {ratableSegs.map(s => {
                    const locked = segLocked(s.key);
                    return (
                      <button key={s.key} type="button" disabled={locked}
                        onClick={() => setSeg(s.key)}
                        title={locked ? "아직 입력할 수 없는 구간입니다." : ""}
                        className={`px-3 py-1 rounded text-sm ${seg===s.key?"bg-blue-600 text-white":"bg-gray-100"} ${locked?"opacity-40 cursor-not-allowed":""}`}>
                        {locked ? "🔒 " : ""}{s.label}
                      </button>
                    );
                  })}
                </div>
              )}
              {segLocked(seg) ? (
                <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded p-3">
                  🔒 {lockMsg}
                </p>
              ) : (
                <>
                  <p className="text-sm font-semibold mb-2">평점 매기기 (1~10)</p>
                  <div className="grid grid-cols-5 sm:grid-cols-10 gap-1 mb-3">
                    {[1,2,3,4,5,6,7,8,9,10].map(n => (
                      <button key={n} onClick={() => setScore(n)}
                        className={`h-10 rounded border text-sm ${score===n?"bg-blue-600 text-white":"bg-white"}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                  <textarea value={comment} onChange={e=>setComment(e.target.value)}
                    placeholder="코멘트 (선택)"
                    className="w-full border rounded p-2 h-20 text-sm"/>
                  <p className="text-[11px] text-gray-400 mt-1 leading-snug">
                    특정인(선수·감독·심판 등 포함)에 대한 과도한 욕설·비방·모욕, 근거 없는 명예훼손은
                    통보 없이 삭제될 수 있습니다. 평점·코멘트는 작성자 개인의 의견입니다.
                  </p>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-gray-500">{comment.length}자</span>
                    <button onClick={submit} disabled={score===null}
                      className="bg-blue-600 text-white px-4 py-1.5 rounded disabled:opacity-40">등록</button>
                  </div>
                  {msg && <p className="text-sm mt-2 text-red-500">{msg}</p>}
                </>
              )}
            </>
          ) : <p className="text-sm text-gray-500">로그인 후 평점을 등록할 수 있습니다.</p>}
        </div>

        <div className="p-5">
          <h4 className="font-semibold mb-3">코멘트 {data ? `(${data.comments.length})` : ""}</h4>
          {!data && <p className="text-sm text-gray-400">불러오는 중...</p>}
          {data && data.comments.length === 0 && <p className="text-sm text-gray-400">아직 코멘트가 없습니다.</p>}
          {top3.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-orange-600 font-semibold mb-1">🔥 인기 코멘트</p>
              {top3.map((c:any) => <CommentRow key={c.id} c={c} onLike={() => like(c.id)} onReload={load} loggedIn={loggedIn} isAdmin={!!data?.isAdmin} highlight/>)}
            </div>
          )}
          {rest.map((c:any) => <CommentRow key={c.id} c={c} onLike={() => like(c.id)} onReload={load} loggedIn={loggedIn} isAdmin={!!data?.isAdmin} />)}
        </div>
      </div>
    </div>
  );
}

function CommentRow({ c, onLike, onReload, loggedIn, isAdmin, highlight }:
  { c: any; onLike: () => void; onReload: () => void; loggedIn: boolean; isAdmin?: boolean; highlight?: boolean }) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState(false); // 블라인드 코멘트 펼쳐보기
  const replies: any[] = c.replies || [];

  async function submitReply() {
    const t = replyText.trim();
    if (!t) return;
    setBusy(true);
    const res = await fetch(`/api/comment/${c.id}/reply`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: t }),
    });
    setBusy(false);
    if (!res.ok) { alert((await res.json()).error || "답글 등록 실패"); return; }
    setReplyText(""); setReplyOpen(false);
    onReload();
  }

  async function report() {
    if (!loggedIn) { alert("로그인이 필요합니다."); return; }
    if (c.reportedByMe) { alert("이미 신고한 코멘트입니다."); return; }
    const reason = prompt("신고 사유를 입력해주세요 (선택).\n예: 욕설/비방, 허위사실, 도배 등");
    if (reason === null) return; // 취소
    setBusy(true);
    const res = await fetch(`/api/comment/${c.id}/report`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { alert(j.error || "신고 실패"); return; }
    alert("신고가 접수되었습니다.");
    onReload();
  }

  async function setBlind(blinded: boolean) {
    setBusy(true);
    const res = await fetch(`/api/admin/comment/${c.id}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ blinded }),
    });
    setBusy(false);
    if (!res.ok) { alert("처리 실패"); return; }
    onReload();
  }

  async function removeComment() {
    if (!confirm("이 코멘트를 삭제할까요? (평점 점수는 유지되고 코멘트 내용만 삭제됩니다)")) return;
    setBusy(true);
    const res = await fetch(`/api/admin/comment/${c.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) { alert("삭제 실패"); return; }
    onReload();
  }

  // 블라인드 처리: 관리자가 아니고 펼치지 않았으면 가림
  const hidden = c.blinded && !isAdmin && !revealed;

  return (
    <div className={`border rounded p-3 mb-2 ${highlight && !c.blinded ? "bg-orange-50 border-orange-200" : ""} ${c.blinded ? "bg-gray-50 border-gray-200" : ""}`}>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{c.username} · ⭐ {c.score}{isAdmin && c.reportCount > 0 ? <span className="text-red-500"> · 🚩 {c.reportCount}</span> : null}</span>
        {!c.blinded && <button onClick={onLike} className="hover:text-red-500">👍 {c.likes}</button>}
      </div>

      {hidden ? (
        <p className="text-sm text-gray-400 italic">
          🚫 신고가 누적되어 가려진 코멘트입니다.
          <button onClick={() => setRevealed(true)} className="ml-2 text-blue-500 underline not-italic">보기</button>
        </p>
      ) : (
        <>
          {c.blinded && (
            <p className="text-xs text-amber-600 mb-1">🚫 {isAdmin ? "신고 누적으로 자동 블라인드됨" : "신고에 의해 가려진 코멘트"}</p>
          )}
          <p className="text-sm whitespace-pre-wrap">{c.text}</p>
        </>
      )}

      <div className="mt-1 flex items-center gap-3">
        <button
          onClick={() => loggedIn ? setReplyOpen(!replyOpen) : alert("로그인이 필요합니다.")}
          className="text-xs text-gray-400 hover:text-blue-600">
          💬 답글{replies.length > 0 ? ` ${replies.length}` : ""}
        </button>
        {!c.mine && (
          <button onClick={report} disabled={busy || c.reportedByMe}
            className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-40">
            🚩 {c.reportedByMe ? "신고됨" : "신고"}
          </button>
        )}
        {isAdmin && (
          <>
            {c.blinded
              ? <button onClick={() => setBlind(false)} disabled={busy} className="text-xs text-green-600 hover:underline">복구</button>
              : <button onClick={() => setBlind(true)} disabled={busy} className="text-xs text-amber-600 hover:underline">블라인드</button>}
            <button onClick={removeComment} disabled={busy} className="text-xs text-red-500 hover:underline">삭제</button>
          </>
        )}
      </div>

      {replies.length > 0 && !hidden && (
        <div className="mt-2 space-y-1.5 border-l-2 border-gray-200 pl-3">
          {replies.map(r => (
            <div key={r.id} className="text-sm">
              <span className="text-xs text-gray-500 mr-1.5">↳ {r.username}</span>
              <span className="whitespace-pre-wrap">{r.text}</span>
            </div>
          ))}
        </div>
      )}

      {replyOpen && (
        <div className="mt-2 flex gap-1">
          <input value={replyText} onChange={e => setReplyText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") submitReply(); }}
            placeholder="답글 입력" className="flex-1 border rounded px-2 py-1 text-sm"/>
          <button onClick={submitReply} disabled={busy || !replyText.trim()}
            className="text-xs px-3 bg-blue-600 text-white rounded disabled:opacity-40">등록</button>
        </div>
      )}
    </div>
  );
}

function AddPlayerModal({ matchId, homeTeam, awayTeam, onClose }:
  { matchId: string; homeTeam: string; awayTeam: string; onClose: () => void }) {
  const [name, setName] = useState("");
  const [team, setTeam] = useState(homeTeam);
  const [starter, setStarter] = useState(true);       // 선발 여부
  const [group, setGroup] = useState<"GK" | "DF" | "MF" | "FW">("MF"); // 선발 시 역할군
  const [segment, setSegment] = useState("all");
  const [msg, setMsg] = useState("");

  const GROUPS: { key: "GK" | "DF" | "MF" | "FW"; label: string }[] = [
    { key: "GK", label: "GK 골키퍼" }, { key: "DF", label: "DF 수비" },
    { key: "MF", label: "MF 미드필더" }, { key: "FW", label: "FW 공격" },
  ];

  async function submit() {
    if (!name.trim()) { setMsg("이름을 입력하세요."); return; }
    // 선발: 역할군 기본 코드로 피치 배치 / 후보: 역할 비움 → 후보칸
    const role = starter ? (GROUP_DEFAULT[group] ?? "CM") : "";
    const res = await fetch("/api/match-player", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ matchId, name: name.trim(), team, role, segment, isDefault: starter }),
    });
    const j = await res.json();
    if (!res.ok) { setMsg(j.error); return; }
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-md w-full p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold">선수 추가</h3>

        <input className="border rounded w-full p-2" placeholder="선수 이름" value={name} onChange={e=>setName(e.target.value)}/>

        <select className="border rounded w-full p-2" value={team} onChange={e=>setTeam(e.target.value)}>
          <option value={homeTeam}>{homeTeam}</option>
          <option value={awayTeam}>{awayTeam}</option>
          <option value="공통">공통 (심판 등)</option>
        </select>

        {/* 선발 / 후보 토글 */}
        <div className="flex gap-2">
          <button type="button" onClick={() => setStarter(true)}
            className={`flex-1 py-2 rounded-lg border text-sm font-bold ${starter ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-500"}`}>
            ⚽ 선발 (피치)
          </button>
          <button type="button" onClick={() => setStarter(false)}
            className={`flex-1 py-2 rounded-lg border text-sm font-bold ${!starter ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-500"}`}>
            🔁 후보/교체
          </button>
        </div>

        {/* 선발이면 역할군 선택 */}
        {starter && (
          <div>
            <p className="text-xs text-gray-500 mb-1.5">역할군 (등록 후 드래그하면 그 위치의 세부 포지션으로 자동 변경)</p>
            <div className="grid grid-cols-4 gap-1.5">
              {GROUPS.map(g => (
                <button key={g.key} type="button" onClick={() => setGroup(g.key)}
                  className={`py-2 rounded-lg border text-xs font-bold ${group === g.key ? "bg-amber-500 text-white border-amber-500" : "bg-white text-gray-600"}`}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <select className="border rounded w-full p-2" value={segment} onChange={e=>setSegment(e.target.value)}>
          <option value="all">전·후반 출전</option>
          <option value="first">전반만</option>
          <option value="second">후반만</option>
        </select>

        {msg && <p className="text-red-500 text-sm">{msg}</p>}
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-1.5 border rounded">취소</button>
          <button onClick={submit} className="px-4 py-1.5 bg-blue-600 text-white rounded">추가</button>
        </div>
      </div>
    </div>
  );
}
