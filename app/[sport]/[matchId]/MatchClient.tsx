"use client";
import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import BaseballField from "./BaseballField";
import SoccerField from "./SoccerField";
import LckLineup from "./LckLineup";
import DeleteMatchButton from "@/components/DeleteMatchButton";
import type { Player, Agg } from "./types";

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

export default function MatchClient({ match, players: rawPlayers, agg }:
  { match: any; players: Player[]; agg: Agg }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [seg, setSeg] = useState("full");
  const [open, setOpen] = useState<Player | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const isAdmin = (session?.user as any)?.role === "admin";

  const segments = segmentsFor(match.sport);
  const players = useMemo(() => applyAgg(rawPlayers, agg, seg), [rawPlayers, agg, seg]);

  // 전반/후반 출전 구성: 총평은 전체, 전/후반 탭은 해당 출전자만
  const segFiltered = players.filter(p =>
    seg === "full" || !p.segment || p.segment === "all" || p.segment === seg);

  // 야구: 기본 우선선수만, "더보기" 시 전체
  const visiblePlayers = (match.sport === "kbo" && !showAll)
    ? segFiltered.filter(p => p.isDefault)
    : segFiltered;

  // 감독/코치/심판 분리 (축구)
  const isOfficial = (p: Player) => /심판|주심|부심|VAR/i.test(p.role || "");
  const isStaff = (p: Player) => /감독|코치/.test(p.role || "");
  const officials = visiblePlayers.filter(isOfficial);
  const fieldPlayers = visiblePlayers.filter(p => !isOfficial(p) && !isStaff(p));

  const home = fieldPlayers.filter(p => p.team === match.homeTeam);
  const away = fieldPlayers.filter(p => p.team === match.awayTeam);
  const homeStaff = visiblePlayers.filter(p => isStaff(p) && p.team === match.homeTeam);
  const awayStaff = visiblePlayers.filter(p => isStaff(p) && p.team === match.awayTeam);

  // POG: 총평 기준
  const totalPlayers = applyAgg(rawPlayers, agg, "full");
  const rated = totalPlayers.filter(p => p.avg !== null);
  rated.sort((a, b) => (b.avg! - a.avg!) || (b.count - a.count));
  const pog = rated[0] || null;

  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold mb-1">{match.homeTeam} {match.homeScore ?? "-"} : {match.awayScore ?? "-"} {match.awayTeam}</h1>
          <p className="text-gray-500 mb-2">{new Date(match.date).toLocaleString("ko-KR")}</p>
        </div>
        <DeleteMatchButton matchId={match.id} afterDelete={() => router.push("/")} />
      </div>

      <MatchRecord matchId={match.id} record={match.record} />

      {pog && (
        <div className="bg-yellow-50 border border-yellow-300 rounded p-3 mb-4">
          🏆 <b>POG/POM</b>: {pog.name} ({pog.team}) — 평균 {pog.avg} / {pog.count}명 참여
        </div>
      )}

      {segments.length > 1 && (
        <div className="flex gap-1 mb-4 border-b overflow-x-auto">
          {segments.map(s => (
            <button key={s.key} onClick={() => setSeg(s.key)}
              className={`px-4 py-2 whitespace-nowrap ${seg===s.key?"border-b-2 border-blue-600 font-semibold text-blue-600":""}`}>
              {s.label}
            </button>
          ))}
        </div>
      )}

      <div className="mb-4 flex gap-2 justify-end">
        {match.sport === "kbo" && (
          <button onClick={() => setShowAll(!showAll)} className="text-sm px-3 py-1 border rounded bg-white">
            {showAll ? "우선 선수만" : `전체 선수 보기 (${players.length}명)`}
          </button>
        )}
        {session && (
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
      </div>

      {manageOpen && isAdmin && (
        <LineupManager players={players} onChanged={() => router.refresh()} />
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
          <SoccerField home={home} away={away}
            homeStaff={homeStaff} awayStaff={awayStaff} officials={officials}
            homeTeam={match.homeTeam} awayTeam={match.awayTeam}
            flip={seg === "second"} /* 후반: 진영 반대 (총평은 전반 기준 유지) */
            onPick={setOpen}/>
        )}
        {match.sport === "lck" && (
          <LckLineup home={home} away={away} homeTeam={match.homeTeam} awayTeam={match.awayTeam} onPick={setOpen}/>
        )}
      </div>

      {open && <PlayerModal matchId={match.id} player={open} loggedIn={!!session} segment={seg}
        segments={segments} onClose={() => { setOpen(null); router.refresh(); }}/>}

      {addOpen && <AddPlayerModal matchId={match.id} homeTeam={match.homeTeam} awayTeam={match.awayTeam}
        onClose={() => { setAddOpen(false); router.refresh(); }}/>}
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
      <p className="font-semibold mb-2">⚙️ 전/후반 명단 관리 <span className="font-normal text-xs text-gray-500">— 출전 구간을 바꾸면 전반/후반 탭에 해당 선수만 표시됩니다</span></p>
      {Object.keys(byTeam).map(team => (
        <div key={team} className="mb-3">
          <p className="text-xs font-semibold text-gray-500 mb-1">{team}</p>
          <div className="space-y-1">
            {byTeam[team].map(p => (
              <div key={p.mpId} className="flex items-center gap-2 bg-white border rounded px-2 py-1.5">
                <span className="flex-1 truncate">{p.name} <span className="text-xs text-gray-400">{p.role}</span></span>
                <div className="flex rounded overflow-hidden border">
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
            ))}
          </div>
        </div>
      ))}
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

function PlayerModal({ matchId, player, loggedIn, segment, segments, onClose }:
  { matchId: string; player: Player; loggedIn: boolean; segment: string; segments:{key:string;label:string}[]; onClose: () => void }) {
  const [seg, setSeg] = useState(segment === "full" && segments.length > 1 ? segments[1].key : segment);
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

  const commentLen = comment.trim().length;
  const commentOk = commentLen === 0 || commentLen >= 5; // 코멘트는 선택 — 쓸 경우만 5자 이상
  const ratableSegs = segments.filter(s => s.key !== "full");
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
          <button onClick={onClose} className="text-2xl">×</button>
        </div>

        <div className="p-5 border-b">
          {loggedIn ? (
            <>
              {ratableSegs.length > 1 && (
                <div className="flex gap-1 mb-3 flex-wrap">
                  {ratableSegs.map(s => (
                    <button key={s.key} type="button" onClick={() => setSeg(s.key)}
                      className={`px-3 py-1 rounded text-sm ${seg===s.key?"bg-blue-600 text-white":"bg-gray-100"}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-sm font-semibold mb-2">평점 매기기 (2~9)</p>
              <div className="flex gap-1 flex-wrap mb-3">
                {[2,3,4,5,6,7,8,9].map(n => (
                  <button key={n} onClick={() => setScore(n)}
                    className={`w-10 h-10 rounded border ${score===n?"bg-blue-600 text-white":"bg-white"}`}>
                    {n}
                  </button>
                ))}
              </div>
              <textarea value={comment} onChange={e=>setComment(e.target.value)}
                placeholder="코멘트 (선택) — 작성 시 5자 이상, 자음/모음만 사용 불가"
                className="w-full border rounded p-2 h-20 text-sm"/>
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-gray-500">
                  {comment.length}자{commentLen > 0 && !commentOk ? " · 5자 이상 입력하거나 비워주세요" : ""}
                </span>
                <button onClick={submit} disabled={score===null || !commentOk}
                  className="bg-blue-600 text-white px-4 py-1.5 rounded disabled:opacity-40">등록</button>
              </div>
              {msg && <p className="text-sm mt-2 text-red-500">{msg}</p>}
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
              {top3.map((c:any) => <CommentRow key={c.id} c={c} onLike={() => like(c.id)} onReload={load} loggedIn={loggedIn} highlight/>)}
            </div>
          )}
          {rest.map((c:any) => <CommentRow key={c.id} c={c} onLike={() => like(c.id)} onReload={load} loggedIn={loggedIn} />)}
        </div>
      </div>
    </div>
  );
}

function CommentRow({ c, onLike, onReload, loggedIn, highlight }:
  { c: any; onLike: () => void; onReload: () => void; loggedIn: boolean; highlight?: boolean }) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState(false);
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

  return (
    <div className={`border rounded p-3 mb-2 ${highlight ? "bg-orange-50 border-orange-200" : ""}`}>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{c.username} · ⭐ {c.score}</span>
        <button onClick={onLike} className="hover:text-red-500">👍 {c.likes}</button>
      </div>
      <p className="text-sm whitespace-pre-wrap">{c.text}</p>

      <div className="mt-1">
        <button
          onClick={() => loggedIn ? setReplyOpen(!replyOpen) : alert("로그인이 필요합니다.")}
          className="text-xs text-gray-400 hover:text-blue-600">
          💬 답글{replies.length > 0 ? ` ${replies.length}` : ""}
        </button>
      </div>

      {replies.length > 0 && (
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
  const [role, setRole] = useState("");
  const [segment, setSegment] = useState("all");
  const [msg, setMsg] = useState("");

  async function submit() {
    if (!name.trim()) { setMsg("이름 입력"); return; }
    const res = await fetch("/api/match-player", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ matchId, name: name.trim(), team, role: role.trim(), segment }),
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
        <input className="border rounded w-full p-2" placeholder="역할 (예: ST/GK/감독/코치/주심 등)" value={role} onChange={e=>setRole(e.target.value)}/>
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
