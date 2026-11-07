"use client";
import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// 작성자 닉네임 → 프로필 링크 (userId 없으면 일반 텍스트)
function Author({ id, name, className }: { id?: string; name: string; className?: string }) {
  if (!id) return <span className={className}>{name}</span>;
  return <Link href={`/u/${id}`} className={`${className || ""} hover:underline`}>{name}</Link>;
}
import BaseballField from "./BaseballField";
import SoccerField from "./SoccerField";
import LckLineup, { LckMatchup, type Highlight } from "./LckLineup";
import DeleteMatchButton from "@/components/DeleteMatchButton";
import ShareButton from "@/components/ShareButton";
import ShareCardPanel from "./ShareCardPanel";
import { teamLabel, GoldStar, pogLabel } from "@/app/MatchCard";
import { teamColor as resolveTeamColor, badgeTextColor, badgeLabel, DEFAULT_HOME, DEFAULT_AWAY } from "@/lib/teamColors";
import { sportPath } from "@/lib/sportUrl";
import type { ShareCardData } from "@/lib/shareCard";
import type { Player, Agg } from "./types";
import { POSITION_MAP, normalizeRole, GROUP_DEFAULT } from "@/lib/soccerPositions";
import { ROUND_PRESETS } from "@/lib/roundPresets";
import { scoreChipStyle, scoreTextColor, isPerfect } from "@/lib/scoreColor";

function segmentsFor(sport: string) {
  if (sport === "kleague" || sport === "epl") return [
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

type Sub = { minute: number; outPlayerId: string; inPlayerId: string; kind?: string | null };

export default function MatchClient({ match, players: rawPlayers, agg, subs = [], teamColors = {}, shareCard = null }:
  { match: any; players: Player[]; agg: Agg; subs?: Sub[]; teamColors?: Record<string, string>; shareCard?: ShareCardData | null }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [seg, setSeg] = useState("full");
  const [open, setOpen] = useState<Player | null>(null);
  const [cRev, setCRev] = useState(0); // 코멘트 요약 재조회 트리거 (모달 닫힐 때 +1)
  const [subsListOpen, setSubsListOpen] = useState(false); // ⚾ 교체 기록 접기/펼치기
  const [showAll, setShowAll] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [editPos, setEditPos] = useState(false);
  const [kboTeam, setKboTeam] = useState<"home" | "away">("home"); // ⚾ 야구: 수비 보여줄 팀
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

  // 야구: 기본 우선선수만 + 교체 출전 선수(실제로 경기에 들어온 선수)는 항상 표시 → 평점 가능
  const subInIds = new Set(subs.map(s => s.inPlayerId));
  const visiblePlayers0 = (match.sport === "kbo" && !showAll && !isMine)
    ? segFiltered.filter(p => p.isDefault || subInIds.has(p.playerId))
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

  // 전체 평점 패널용 — 탭 필터와 무관하게 이 경기 전 출전 선수 (교체 포함)
  const fieldAll = rawPlayers.filter(p => !isOfficial(p) && !isStaff(p));
  const homeAll = fieldAll.filter(p => p.team === match.homeTeam);
  const awayAll = fieldAll.filter(p => p.team === match.awayTeam);

  // 교체 기록 표시용 선수 이름 조회 (야구)
  const nameOf = (id: string) => rawPlayers.find(p => p.playerId === id)?.name ?? "?";

  // LCK 강조: 세트 탭 → POG(해당 세트 최고 평점), 총평 → POM(이긴 팀 최고 평점)
  const lckHighlight: Highlight = useMemo(() => {
    if (match.sport !== "lck" || isMine) return null;
    const rated = fieldPlayers.filter(p => p.avg !== null);
    if (rated.length === 0) return null;
    if (seg === "full") {
      const hs = match.homeScore, as = match.awayScore;
      if (hs == null || as == null || hs === as) return null; // 승팀 불명 → POM 없음
      const winTeam = hs > as ? match.homeTeam : match.awayTeam;
      const pool = rated.filter(p => p.team === winTeam);
      if (pool.length === 0) return null;
      const top = pool.reduce((b, p) => (p.avg! > b.avg! ? p : b));
      return { playerId: top.playerId, kind: "POM" };
    }
    const top = rated.reduce((b, p) => (p.avg! > b.avg! ? p : b));
    return { playerId: top.playerId, kind: "POG" };
  }, [match.sport, seg, isMine, fieldPlayers, match.homeScore, match.awayScore, match.homeTeam, match.awayTeam]);

  // 교체 정보: playerId → 들어옴(in)/나감(out) + 시각
  const subInfo = useMemo(() => {
    const m: Record<string, { dir: "in" | "out"; min: number }> = {};
    for (const s of subs) {
      if (s.inPlayerId && m[s.inPlayerId] === undefined) m[s.inPlayerId] = { dir: "in", min: s.minute };
      if (s.outPlayerId && m[s.outPlayerId] === undefined) m[s.outPlayerId] = { dir: "out", min: s.minute };
    }
    return m;
  }, [subs]);

  // ⚾ 야구 교체 종류: 들어온 선수 playerId → kind(투수교체/대타/대주자/수비교체)
  const subKind = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of subs) if (s.inPlayerId && s.kind) m[s.inPlayerId] = s.kind;
    return m;
  }, [subs]);

  // POG: 총평 기준
  const totalPlayers = applyAgg(rawPlayers, agg, "full");
  const rated = totalPlayers.filter(p => p.avg !== null);
  rated.sort((a, b) => (b.avg! - a.avg!) || (b.count - a.count));
  const pog = rated[0] || null;

  return (
    <div>
      {/* 스코어보드 (3안: 솔리드 서클 팀 배지) */}
      <div className="rounded-2xl bg-card border border-wline shadow-[0_1px_2px_rgba(60,50,20,.05)] p-4 sm:p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <StatusBadge status={match.status} />
            {match.round && <span className="text-xs font-medium text-wsub truncate">{match.round}</span>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ShareButton
              title={`${match.homeTeam} ${match.homeScore ?? "-"} : ${match.awayScore ?? "-"} ${match.awayTeam} 팬 평점`}
              text="fanarena.kr에서 선수 평점을 매겨보세요!"
              path={`/${sportPath(match.sport)}/${match.id}`}
              label="공유" />
            <DeleteMatchButton matchId={match.id} afterDelete={() => router.push("/")} />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 text-center min-w-0">
            <TeamBadge team={match.homeTeam} colors={teamColors} fallback={DEFAULT_HOME} />
            <div className={`text-sm sm:text-base font-bold truncate ${loserSide(match.homeScore, match.awayScore) ? "text-wfaint" : "text-ink"}`}>{teamLabel(match.sport, match.homeTeam)}</div>
            <div className="text-[10px] text-wfaint tracking-widest mt-1">HOME</div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 font-black text-3xl sm:text-4xl tracking-wide shrink-0 tabular-nums">
            <span className={scoreWin(match.homeScore, match.awayScore)}>{match.homeScore ?? "-"}</span>
            <span className="text-xl text-wmute">:</span>
            <span className={scoreWin(match.awayScore, match.homeScore)}>{match.awayScore ?? "-"}</span>
          </div>
          <div className="flex-1 text-center min-w-0">
            <TeamBadge team={match.awayTeam} colors={teamColors} fallback={DEFAULT_AWAY} />
            <div className={`text-sm sm:text-base font-bold truncate ${loserSide(match.awayScore, match.homeScore) ? "text-wfaint" : "text-ink"}`}>{teamLabel(match.sport, match.awayTeam)}</div>
            <div className="text-[10px] text-wfaint tracking-widest mt-1">AWAY</div>
          </div>
        </div>
        <div className="text-center text-[11px] text-wfaint mt-3">
          {new Date(match.date).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
        </div>
      </div>

      {isAdmin && <StatusSwitcher matchId={match.id} status={match.status} onChanged={() => router.refresh()} />}

      {isAdmin && <DateEditor matchId={match.id} date={match.date} onChanged={() => router.refresh()} />}

      {isAdmin && <RoundEditor matchId={match.id} sport={match.sport} round={match.round} onChanged={() => router.refresh()} />}

      {isAdmin && match.sport !== "lck" && (
        <ScoreEditor matchId={match.id} homeTeam={match.homeTeam} awayTeam={match.awayTeam}
          homeScore={match.homeScore} awayScore={match.awayScore} onChanged={() => router.refresh()} />
      )}

      {isAdmin && match.sport === "lck" && (
        <LckSetResults matchId={match.id} homeTeam={match.homeTeam} awayTeam={match.awayTeam}
          initial={match.setResults || {}} onChanged={() => router.refresh()} />
      )}

      <MatchRecord matchId={match.id} record={match.record} sport={match.sport} />

      {match.status === "finished" && (match.seed || isAdmin) && (
        <SeedBanner matchId={match.id} seed={match.seed} isAdmin={isAdmin}
          loggedIn={!!session} onChanged={() => router.refresh()} />
      )}
      {isAdmin && (match.sport === "kleague" || match.sport === "epl") && (
        <button onClick={regenSeed}
          className="text-xs px-2 py-1 mb-4 border rounded bg-card text-wsub hover:bg-wgray">
          🔄 토론거리 자동 생성/갱신
        </button>
      )}

      {pog && (
        <div className="flex items-center gap-2 bg-goldbg border border-goldline rounded-xl px-3.5 py-2.5 mb-4 text-sm">
          <GoldStar className="w-4 h-4" />
          <b className="text-golddim font-extrabold">{pogLabel(match.sport)}</b>
          <span className="text-ink font-bold">{pog.name}</span>
          <span className="text-golddim">({pog.team}) · 평균 <b className="tabular-nums">{pog.avg}</b>{pog.count >= 100 ? ` · ${pog.count}명 참여` : ""}</span>
        </div>
      )}

      {isAdmin && shareCard && <ShareCardPanel data={shareCard} canPreview />}

      {seg !== "mine" && isAdmin && (
        <StatsPanel players={fieldPlayers} homeTeam={match.homeTeam} awayTeam={match.awayTeam}
          segLabel={segments.find(s => s.key === seg)?.label ?? ""} teamColors={teamColors} />
      )}

      {(segments.length > 1 || session) && (
        <div className="flex gap-4 mb-4 border-b border-wline overflow-x-auto px-1">
          {segments.map(s => {
            const setWin = match.sport === "lck" && match.setResults ? match.setResults[s.key] : null;
            return (
            <button key={s.key} onClick={() => setSeg(s.key)}
              className={`pt-1 pb-2.5 whitespace-nowrap text-sm font-bold border-b-[2.5px] -mb-px transition ${
                seg===s.key ? "text-ink border-gold" : "text-wfaint border-transparent hover:text-wsub"}`}>
              {s.label}
              {setWin && <span title={setWin === "home" ? match.homeTeam : match.awayTeam}
                className={`ml-1 inline-block w-1.5 h-1.5 rounded-full align-middle ${setWin === "home" ? "bg-gold" : "bg-live"}`} />}
            </button>
            );
          })}
          {session && (
            <button onClick={() => setSeg("mine")}
              className={`ml-auto inline-flex items-center gap-1 pt-1 pb-2.5 whitespace-nowrap text-sm font-bold border-b-[2.5px] -mb-px transition ${
                seg==="mine" ? "text-ink border-gold" : "text-wfaint border-transparent hover:text-wsub"}`}>
              <GoldStar className="w-3 h-3" /> 나의 평점
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
          <button onClick={() => setShowAll(!showAll)} className="text-sm px-3 py-1 border rounded bg-card">
            {showAll ? "우선 선수만" : `전체 선수 보기 (${players.length}명)`}
          </button>
        )}
        {isAdmin && (
          <button onClick={() => setAddOpen(true)} className="text-sm px-3 py-1 border rounded bg-amber-50 text-ink">
            + 선수 추가
          </button>
        )}
        {isAdmin && (match.sport === "kleague" || match.sport === "epl") && (
          <button onClick={() => setManageOpen(!manageOpen)}
            className="text-sm px-3 py-1 border rounded bg-amber-50 text-amber-700">
            ⚙️ 전/후반 명단 관리
          </button>
        )}
        {isAdmin && (match.sport === "kleague" || match.sport === "epl") && (
          <button onClick={() => setSubOpen(!subOpen)}
            className="text-sm px-3 py-1 border rounded bg-amber-50 text-amber-700">
            🔁 교체 정보 입력
          </button>
        )}
        {isAdmin && (match.sport === "kleague" || match.sport === "epl") && (
          <button onClick={() => setEditPos(!editPos)}
            className={`text-sm px-3 py-1 border rounded ${editPos ? "bg-amber-500 text-white border-amber-500" : "bg-amber-50 text-amber-700"}`}>
            {editPos ? "✓ 위치 편집 종료" : "✋ 선수 위치 편집"}
          </button>
        )}
        {isAdmin && (match.sport === "kleague" || match.sport === "epl") && editPos && (
          <button onClick={resetPositions}
            className="text-sm px-3 py-1 border rounded bg-card text-wsub">
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
          <div>
            {/* 수비 볼 팀 전환 (야구는 한 번에 한 팀만 수비) */}
            <div className="flex gap-2 mb-3 justify-center">
              {(["home", "away"] as const).map(t => (
                <button key={t} onClick={() => setKboTeam(t)}
                  className={`text-sm font-bold px-4 py-1.5 rounded-full border-[1.5px] transition
                    ${kboTeam === t
                      ? "bg-ink text-paper border-ink"
                      : "bg-card text-wfaint border-wline hover:text-wsub"}`}>
                  {t === "home" ? `${match.homeTeam} 수비` : `${match.awayTeam} 수비`}
                </button>
              ))}
            </div>
            <BaseballField
              players={kboTeam === "home" ? home : away}
              isHome={kboTeam === "home"}
              teamLabel={kboTeam === "home" ? match.homeTeam : match.awayTeam}
              teamColors={teamColors}
              subInfo={subInfo} subKind={subKind}
              highlightId={pog && pog.team === (kboTeam === "home" ? match.homeTeam : match.awayTeam) ? pog.playerId : null}
              onPick={setOpen}/>
          </div>
        )}
        {(match.sport === "kleague" || match.sport === "epl") && (
          <SoccerField key={seg} home={home} away={away}
            homeStaff={homeStaff} awayStaff={awayStaff} officials={officials}
            homeTeam={match.homeTeam} awayTeam={match.awayTeam} teamColors={teamColors}
            highlightId={pog?.playerId ?? null}
            flip={seg === "second"} /* 후반: 진영 반대 (총평은 전반 기준 유지) */
            onPick={setOpen}
            subs={subs} subInfo={subInfo} seg={seg}
            editMode={editPos && isAdmin && seg !== "mine"}
            onMove={savePosition}/>
        )}
        {match.sport === "lck" && (
          <LckLineup home={home} away={away} homeTeam={match.homeTeam} awayTeam={match.awayTeam}
            onPick={setOpen} seg={seg} highlight={lckHighlight}/>
        )}

        {match.sport === "kbo" && subs.length > 0 && (
          <div className="mt-4 bg-card border border-wline rounded-xl p-3">
            <button onClick={() => setSubsListOpen(v => !v)}
              className="w-full flex items-center justify-between text-sm font-bold text-ink">
              <span>교체 기록 <span className="text-wfaint font-semibold">{subs.length}건</span></span>
              <span className="text-[11px] text-wfaint font-semibold">{subsListOpen ? "접기 ▲" : "펼치기 ▼"}</span>
            </button>
            {subsListOpen && (
            <div className="space-y-1 mt-2 pt-2 border-t border-dashed border-wsoft">
              {subs.slice().sort((a, b) => a.minute - b.minute).map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  {s.minute ? <span className="text-[11px] font-bold text-golddim bg-goldbg rounded px-1.5 py-0.5 shrink-0 tabular-nums">{s.minute}회</span> : null}
                  {s.kind && <span className="text-xs text-wsub w-16 shrink-0">{s.kind}</span>}
                  <span className="truncate">{nameOf(s.outPlayerId)}</span>
                  <span className="text-wfaint shrink-0">→</span>
                  <span className="truncate">{nameOf(s.inPlayerId)}</span>
                </div>
              ))}
            </div>
            )}
          </div>
        )}
      </div>

      {/* ⚡ 전체 평점 한번에 — 축구, 필드 밑 접이식 (경기 시작 후) */}
      {(match.sport === "kleague" || match.sport === "epl") && match.status !== "scheduled" && (homeAll.length > 0 || awayAll.length > 0) && (
        <BulkRatePanel home={homeAll} away={awayAll} homeTeam={match.homeTeam} awayTeam={match.awayTeam}
          matchId={match.id} sport={match.sport} segments={segments} status={match.status}
          teamColors={teamColors} loggedIn={!!session}
          onSaved={() => { setCRev(v => v + 1); router.refresh(); }} />
      )}

      {/* 평점 리스트 (캡처용) — 축구·야구, 현재 탭 기준 */}
      {(match.sport === "kleague" || match.sport === "epl" || match.sport === "kbo") && (home.length > 0 || away.length > 0) && (
        <RatingList home={home} away={away} homeTeam={match.homeTeam} awayTeam={match.awayTeam}
          isMine={isMine} pog={pog} onPick={setOpen} subInfo={subInfo} sport={match.sport} teamColors={teamColors}
          matchId={match.id} seg={seg} loggedIn={!!session} rev={cRev} />
      )}

      {/* 라인 대결 비교 — LCK만, 현재 세트 탭 기준 */}
      {match.sport === "lck" && seg !== "mine" && (home.length > 0 || away.length > 0) && (
        <LckMatchup home={home} away={away} homeTeam={match.homeTeam} awayTeam={match.awayTeam}
          onPick={setOpen} seg={seg} highlight={lckHighlight} />
      )}

      {open && <PlayerModal matchId={match.id} player={open} loggedIn={!!session} segment={seg}
        segments={segments} status={match.status} sport={match.sport}
        onClose={() => { setOpen(null); setCRev(v => v + 1); router.refresh(); }}/>}

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
      <p className="text-[11px] text-golddim mb-3">"분 · 나간 선수(OUT) → 들어온 선수(IN)"를 등록하면 마커·리스트에 교체 표시가 나타납니다.</p>

      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-1.5 mb-2 flex-wrap">
          <input value={r.minute} onChange={e => upd(i, "minute", e.target.value)}
            inputMode="numeric" placeholder="분" className="w-12 border rounded px-2 py-1.5 text-sm text-center" />
          <span className="text-[11px] text-wfaint">분</span>
          <select value={r.outPlayerId} onChange={e => upd(i, "outPlayerId", e.target.value)}
            className="flex-1 min-w-[100px] border rounded px-2 py-1.5 text-sm bg-card">
            <option value="">나간 선수(OUT)</option>
            {opts.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <span className="text-green-600 font-extrabold">→</span>
          <select value={r.inPlayerId} onChange={e => upd(i, "inPlayerId", e.target.value)}
            className="flex-1 min-w-[100px] border rounded px-2 py-1.5 text-sm bg-card">
            <option value="">들어온 선수(IN)</option>
            {opts.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <button onClick={() => del(i)} className="text-red-500 font-bold px-1.5">✕</button>
        </div>
      ))}

      <div className="flex items-center gap-3 mt-2">
        <button onClick={add} className="text-sm text-ink font-semibold">+ 교체 추가</button>
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

// ⚾ 야구 포지션 그룹 (포지션 비교용)
function baseballPosGroup(role: string | undefined, isPitcher?: boolean | null): string | null {
  const r = (role || "").trim();
  if (isPitcher || /투수|선발|마무리|불펜|중계|셋업/.test(r)) return "P";
  if (/포수/.test(r)) return "C";
  if (/1루|2루|3루|유격|내야/.test(r)) return "IF";
  if (/좌익|중견|우익|외야/.test(r)) return "OF";
  if (/지명/.test(r)) return "DH";
  return null;
}
const BB_GROUP_LABEL: Record<string, string> = { P: "투수", C: "포수", IF: "내야수", OF: "외야수", DH: "지명타자" };
const BB_GROUP_ICON: Record<string, string> = { P: "⚾", C: "🧤", IF: "🔷", OF: "🟢", DH: "🏏" };
const BB_GROUP_ORDER = ["P", "C", "IF", "OF", "DH"] as const;

// 평점 리스트 (높은순 / 낮은순 / 포지션 비교) — 행마다 베스트 한 줄 + 펼치면 인라인 토론
type CommentSummary = {
  players: Record<string, { count: number; top: { id: string; score: number; text: string; likes: number }[] }>;
  myRatings: Record<string, Record<string, number>>;
};

function RatingList({ home, away, homeTeam, awayTeam, isMine, pog, onPick, subInfo = {}, sport, teamColors = {},
  matchId, seg, loggedIn, rev }:
  { home: Player[]; away: Player[]; homeTeam: string; awayTeam: string;
    isMine: boolean; pog: Player | null; onPick: (p: Player) => void;
    subInfo?: Record<string, { dir: "in" | "out"; min: number }>; sport?: string;
    teamColors?: Record<string, string>;
    matchId: string; seg: string; loggedIn: boolean; rev: number }) {
  const [mode, setMode] = useState<"high" | "low" | "pos">("high");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false); // 6위부터 접힘 → 펼치기
  const [cdata, setCdata] = useState<CommentSummary | null>(null);
  const all = [...home, ...away];

  // 선수별 코멘트 요약 (베스트 한 줄·개수·내 평점) — 경기 단위 1회 조회
  async function loadComments() {
    try {
      const r = await fetch(`/api/match-comments?matchId=${matchId}`);
      if (r.ok) setCdata(await r.json());
    } catch {}
  }
  useEffect(() => { loadComments(); /* eslint-disable-next-line */ }, [matchId, rev]);

  async function likeComment(id: string) {
    if (!loggedIn) { alert("로그인이 필요합니다."); return; }
    await fetch(`/api/comment/${id}/like`, { method: "POST" });
    loadComments();
  }
  // 사이드 바/닷에 쓸 실제 구단색 (없으면 홈/원정 기본색)
  const hColor = resolveTeamColor(homeTeam, teamColors, DEFAULT_HOME);
  const aColor = resolveTeamColor(awayTeam, teamColors, DEFAULT_AWAY);
  // 포지션 그룹: 야구는 투수/포수/내야/외야/지명, 그 외(축구)는 GK/DF/MF/FW
  const isBaseball = sport === "kbo";
  const groupOf = (p: Player) => isBaseball ? baseballPosGroup(p.role, p.isPitcher) : posGroup(p.role);
  const GORDER: readonly string[] = isBaseball ? BB_GROUP_ORDER : GROUP_ORDER;
  const GLABEL = isBaseball ? BB_GROUP_LABEL : GROUP_LABEL;
  const GICON = isBaseball ? BB_GROUP_ICON : GROUP_ICON;

  // 정렬 리스트 (평점 있는 선수만)
  const ratedSorted = all.filter(p => p.avg !== null)
    .sort((a, b) => mode === "low" ? (a.avg! - b.avg!) : (b.avg! - a.avg!));

  // 교체 배지 (→들어옴 / ←나감 + 분) — 기능 유지, 톤만 3안
  function SubBadge({ pid }: { pid: string }) {
    const s = subInfo[pid];
    if (!s) return null;
    return (
      <span className={`text-[9px] font-extrabold text-white rounded px-1 py-0.5 ${s.dir === "in" ? "bg-[#3c7d46]" : "bg-live"}`}>
        {s.dir === "in" ? "→" : "←"}{s.min}{sport === "kbo" ? "회" : "'"}
      </span>
    );
  }

  // 펼침 패널: 상위 코멘트 + 좋아요 + 평점 CTA (행·포디움 공용)
  function ExpandedPanel({ p, indent = true }: { p: Player; indent?: boolean }) {
    const pc = cdata?.players?.[p.playerId];
    const myScore = cdata?.myRatings?.[p.playerId]?.[seg];
    return (
      <div className={`${indent ? "pl-[44px]" : "pl-3"} pr-3 pb-3 pt-1`}>
        {(pc?.top ?? []).map(c => (
          <div key={c.id} className="flex items-center gap-2 py-1.5 border-t border-dashed border-wsoft first:border-t-0">
            <span className="min-w-[19px] h-[17px] px-1 rounded inline-flex items-center justify-center text-[10px] font-extrabold shrink-0" style={scoreChipStyle(c.score)}>{c.score}</span>
            <span className="text-[13px] text-ink flex-1 min-w-0 break-words">{c.text}</span>
            <button onClick={() => likeComment(c.id)}
              className="shrink-0 text-[11px] text-wsub border border-wline rounded-full px-2 py-0.5 hover:border-ink hover:text-ink transition tabular-nums">
              👍 {c.likes}
            </button>
          </div>
        ))}
        <div className="flex gap-1.5 mt-2 items-center">
          <button onClick={() => onPick(p)}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-full py-1.5 text-[12.5px] font-bold transition ${
              myScore != null
                ? "bg-card text-ink border-[1.5px] border-ink hover:bg-paper"
                : "bg-ink text-paper hover:opacity-90"}`}>
            {myScore != null ? (
              <>내 평점 수정
                <span className="min-w-[19px] h-[17px] px-1 rounded inline-flex items-center justify-center text-[10px] font-extrabold" style={scoreChipStyle(myScore)}>{myScore}</span>
              </>
            ) : (
              <><GoldStar className="w-3 h-3" /> 내 평점·코멘트 남기기</>
            )}
          </button>
          {pc?.count ? (
            <button onClick={() => onPick(p)}
              className="shrink-0 text-[11.5px] font-semibold text-wsub border border-wline bg-card rounded-full px-3 py-1.5 hover:border-ink hover:text-ink transition tabular-nums">
              전체 {pc.count}개
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  // R4 컴팩트 행: 한 줄 고정 — 베스트 한마디는 있는 행만 인라인(데스크톱), 없으면 순수 한 줄
  function Row({ p, rank }: { p: Player; rank: number }) {
    const isHome = p.team === homeTeam;
    const v = p.avg!;
    // 순위 색 (높은순 1~3위 골드/실버/브론즈 텍스트)
    const rkColor = mode !== "high" ? "text-wmute"
      : rank === 1 ? "text-golddim" : rank === 2 ? "text-wsub" : rank === 3 ? "text-[color:var(--sc-orange)]" : "text-wmute";
    const pc = cdata?.players?.[p.playerId];
    const best = pc?.top?.[0];
    const isOpen = !isMine && expanded === p.playerId;

    return (
      <div className={`border-t border-wsoft first:border-t-0 ${isOpen ? "border-l-[3px] border-l-gold" : ""}`}>
        <button onClick={() => isMine ? onPick(p) : setExpanded(isOpen ? null : p.playerId)}
          className="w-full px-3 py-[7px] hover:bg-paper text-left">
          <span className="flex items-center gap-2">
            <span className={`w-5 shrink-0 text-center text-[12px] font-extrabold tabular-nums ${rkColor}`}>{rank}</span>
            <span className="w-[3px] h-[15px] rounded-sm shrink-0" style={{ background: isHome ? hColor : aColor }} />
            <span className="text-[13px] font-bold text-ink truncate">{p.name}</span>
            {p.role && <span className="text-[9.5px] font-extrabold text-wgraytx bg-wgray rounded px-1 py-px shrink-0">{p.role}</span>}
            <SubBadge pid={p.playerId} />
            <span className="flex-1 min-w-0 flex items-center justify-end">
              {!isMine && best && (
                <span className="hidden sm:inline text-[11px] text-wfaint truncate">
                  “{best.text}” <b className="text-wsub font-extrabold tabular-nums">👍 {best.likes}</b>
                </span>
              )}
            </span>
            {!isMine && pc?.count ? <span className="text-[10.5px] text-wfaint shrink-0 tabular-nums">💬 {pc.count}</span> : null}
            <span className="min-w-[38px] h-[22px] px-1.5 shrink-0 flex items-center justify-center text-[12px] font-extrabold rounded-[7px] tabular-nums" style={scoreChipStyle(v)}>{v}</span>
            {!isMine && <span className="text-[10px] text-wfaint shrink-0 w-2 text-center">{isOpen ? "▴" : "▾"}</span>}
          </span>
        </button>
        {isOpen && <ExpandedPanel p={p} />}
      </div>
    );
  }

  // R4 포디움: 높은순 TOP3 카드 — 베스트 한마디 포함, 코멘트 없는 카드만 유도 문구
  function Podium({ top }: { top: Player[] }) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2.5 border-b border-wsoft">
        {top.map((p, i) => {
          const rank = i + 1;
          const gold = rank === 1;
          const pc = cdata?.players?.[p.playerId];
          const best = pc?.top?.[0];
          const isOpen = !isMine && expanded === p.playerId;
          const isPog = pog?.playerId === p.playerId;
          return (
            <button key={p.mpId}
              onClick={() => isMine ? onPick(p) : setExpanded(isOpen ? null : p.playerId)}
              className={`podium-card ${gold ? "podium-gold" : ""} text-left rounded-xl border p-2.5 transition hover:-translate-y-0.5 hover:shadow-md ${
                gold ? "border-goldline col-span-2 sm:col-span-1" : "border-wline"} ${isOpen ? "ring-1 ring-gold" : ""}`}>
              <span className={`block text-[10px] font-extrabold mb-1 ${gold ? "text-gold" : "text-wfaint"}`}>
                {gold && isPog ? `★ 1위 · ${pogLabel(sport || "")}` : `${rank}위`}
              </span>
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="w-[3px] h-[14px] rounded-sm shrink-0" style={{ background: p.team === homeTeam ? hColor : aColor }} />
                <span className="text-[13.5px] font-extrabold text-ink truncate">{p.name}</span>
                {p.role && <span className="text-[9px] font-extrabold text-wgraytx bg-wgray rounded px-1 py-px shrink-0">{p.role}</span>}
                <SubBadge pid={p.playerId} />
              </span>
              <span className="flex items-baseline gap-1.5 mt-1.5">
                <span className="text-[18px] font-black tabular-nums leading-none" style={{ color: scoreTextColor(p.avg!) }}>{p.avg}</span>
                <span className="text-[10px] text-wfaint font-semibold tabular-nums">평가 {p.count}{pc?.count ? ` · 💬 ${pc.count}` : ""}</span>
              </span>
              <span className={`block mt-2 pt-1.5 border-t border-dashed border-wsoft text-[10.5px] leading-snug ${best ? "text-wsub" : "text-wmute italic"}`}
                style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {best ? <>“{best.text}” <b className="text-wfaint font-extrabold tabular-nums">👍 {best.likes}</b></> : "첫 한마디를 남겨보세요"}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  // 포지션 비교: 그룹별로 양 팀 평점 높은 순 나란히 (가시성 개선)
  function posCompare() {
    const sortByAvg = (a: Player, b: Player) => (b.avg ?? -1) - (a.avg ?? -1);

    // 한쪽 셀 렌더 — 승자는 골드 스퀘어 + 잉크 테두리 (팀 구분은 사이드 컬러가 담당)
    const Cell = ({ p, side, win }: { p?: Player; side: "home" | "away"; win: boolean }) => {
      const rated = p && p.avg !== null;
      const isHome = side === "home";
      const base = `flex-1 relative flex items-center gap-2 px-3 py-2.5 overflow-hidden ${isHome ? "justify-end" : "flex-row-reverse justify-end"}`;
      if (!p) return <div className={base}><span className="text-[13px] text-wmute italic">—</span></div>;
      return (
        <button onClick={() => onPick(p)} className={base}>
          {win && (
            <span className={`absolute inset-y-0 w-2/3 opacity-[0.15] ${isHome
              ? "right-0 bg-gradient-to-l from-gold to-transparent"
              : "left-0 bg-gradient-to-r from-gold to-transparent"}`} />
          )}
          <span className={`relative z-10 text-[13.5px] truncate max-w-[88px] ${
            win ? "font-extrabold text-ink" : "font-semibold text-wgraytx"}`}>{p.name}</span>
          <span className={`relative z-10 w-9 h-9 rounded-[11px] flex items-center justify-center text-[13px] font-extrabold shrink-0 tabular-nums ${
            win ? "border-2 border-ink" : ""} ${!rated ? "bg-paper text-wmute" : ""}`}
            style={rated ? scoreChipStyle(p.avg!) : undefined}>
            {rated ? p.avg : "–"}
          </span>
        </button>
      );
    };

    return GORDER.map(g => {
      const h = home.filter(p => groupOf(p) === g).sort(sortByAvg);
      const a = away.filter(p => groupOf(p) === g).sort(sortByAvg);
      const rows = Math.max(h.length, a.length);
      if (rows === 0) return null;
      return (
        <div key={g}>
          <div className="bg-wgray text-[11px] font-extrabold text-wsub px-3.5 py-1.5 border-t border-wline tracking-wide">
            {GLABEL[g]}
          </div>
          {Array.from({ length: rows }).map((_, i) => {
            const ph = h[i], pa = a[i];
            const hv = ph?.avg ?? null, av = pa?.avg ?? null;
            const hWin = hv !== null && av !== null && hv > av;
            const aWin = hv !== null && av !== null && av > hv;
            const bothEmpty = hv === null && av === null;
            return (
              <div key={i} className={`flex items-stretch border-t border-wsoft min-h-[52px] ${bothEmpty ? "opacity-50" : ""}`}>
                <Cell p={ph} side="home" win={hWin} />
                <div className="w-8 shrink-0 flex items-center justify-center border-x border-wsoft">
                  {hWin || aWin ? <GoldStar className="w-3.5 h-3.5" /> : <span className="text-[8px] font-extrabold text-wmute">VS</span>}
                </div>
                <Cell p={pa} side="away" win={aWin} />
              </div>
            );
          })}
        </div>
      );
    });
  }

  // R4: 큰 알약 3개 → 작은 세그먼트 컨트롤
  const btn = (k: "high" | "low" | "pos", label: string) => (
    <button onClick={() => setMode(k)}
      className={`text-[11.5px] font-bold px-3.5 py-1.5 rounded-[7px] transition ${
        mode === k ? "bg-ink text-deep" : "text-wsub hover:text-ink"}`}>
      {label}
    </button>
  );

  return (
    <div className="mt-5">
      <div className="inline-flex gap-0.5 mb-3 bg-well border border-wsoft rounded-[10px] p-[3px]">
        {btn("high", "평점 높은순")}
        {btn("low", "낮은순")}
        {btn("pos", "포지션 비교")}
      </div>

      <div className="bg-card border border-wline rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-wsoft">
          <span className="text-[13px] font-extrabold text-ink">평점 {mode === "pos" ? "포지션 비교" : "순위"}</span>
          <span className="text-[11px] text-wfaint font-semibold">{isMine ? "나의 평점" : "총평"}{mode === "low" ? " · 낮은 순" : mode === "high" ? " · 높은 순" : ""}</span>
        </div>

        {mode === "pos" && (
          <div className="flex items-center bg-ink text-paper px-3.5 py-2.5">
            <div className="flex-1 flex items-center gap-1.5 text-[13px] font-extrabold">
              <span className="w-2 h-2 rounded-full" style={{ background: hColor }} />{homeTeam}
            </div>
            <span className="text-[10px] font-bold text-wfaint px-2">VS</span>
            <div className="flex-1 flex items-center justify-end gap-1.5 text-[13px] font-extrabold">
              {awayTeam}<span className="w-2 h-2 rounded-full" style={{ background: aColor }} />
            </div>
          </div>
        )}

        {mode === "pos" ? (
          posCompare()
        ) : ratedSorted.length === 0 ? (
          <p className="text-sm text-wfaint text-center py-6">아직 평점이 없습니다.</p>
        ) : mode === "high" && !isMine && ratedSorted.length >= 3 ? (
          /* R4: TOP3 포디움 + 4~5위 컴팩트 리스트, 6위부터 접힘 */
          <>
            <Podium top={ratedSorted.slice(0, 3)} />
            {(() => {
              const op = ratedSorted.slice(0, 3).find(p => p.playerId === expanded);
              return op ? <div className="border-b border-wsoft"><ExpandedPanel p={op} indent={false} /></div> : null;
            })()}
            {(showAll ? ratedSorted.slice(3) : ratedSorted.slice(3, 5)).map((p, i) => <Row key={p.mpId} p={p} rank={i + 4} />)}
            {ratedSorted.length > 5 && (
              <button onClick={() => setShowAll(v => !v)}
                className="w-full py-2 border-t border-wsoft text-[12px] font-bold text-wsub hover:text-ink hover:bg-paper transition tabular-nums">
                {showAll ? "접기 ▴" : `6위부터 펼치기 · ${ratedSorted.length - 5}명 ▾`}
              </button>
            )}
          </>
        ) : (
          ratedSorted.map((p, i) => <Row key={p.mpId} p={p} rank={i + 1} />)
        )}

        {/* 캡처용 푸터 */}
        <div className="flex items-center justify-center gap-2 bg-ink text-paper text-[12px] font-semibold py-2.5">
          {mode === "low"
            ? (ratedSorted[0] && <span className="text-[#e8a08e]">WORST {ratedSorted[0].name} {ratedSorted[0].avg}</span>)
            : (pog && <span className="inline-flex items-center gap-1.5"><GoldStar className="w-3 h-3" /> {pogLabel(sport || "")} {pog.name} {pog.avg}</span>)}
          <span className="text-wsub">·</span>
          <span>fanarena<span className="text-wfaint">.kr</span></span>
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
      <p className="font-semibold mb-2">⚙️ 명단 관리 <span className="font-normal text-xs text-wsub">— 선발/후보와 출전 구간을 바꿀 수 있습니다</span></p>
      {Object.keys(byTeam).map(team => {
        const starters = byTeam[team].filter(p => p.isDefault !== false).length;
        return (
        <div key={team} className="mb-3">
          <p className="text-xs font-semibold text-wsub mb-1">{team} <span className="text-wfaint">· 선발 {starters}명</span></p>
          <div className="space-y-1">
            {byTeam[team].map(p => {
              const isStarter = p.isDefault !== false;
              return (
              <div key={p.mpId} className="flex items-center gap-2 bg-card border rounded px-2 py-1.5">
                <span className="flex-1 truncate min-w-0">{p.name} <span className="text-xs text-wfaint">{p.role}</span></span>
                {/* 선발/후보 토글 */}
                <div className="flex rounded overflow-hidden border shrink-0">
                  <button disabled={busy === p.mpId} onClick={() => setStarter(p, true)}
                    className={`px-2 py-0.5 text-xs ${isStarter ? "bg-green-600 text-white" : "bg-card hover:bg-wgray"}`}>선발</button>
                  <button disabled={busy === p.mpId} onClick={() => setStarter(p, false)}
                    className={`px-2 py-0.5 text-xs ${!isStarter ? "bg-gray-700 text-white" : "bg-card hover:bg-wgray"}`}>후보</button>
                </div>
                <div className="flex rounded overflow-hidden border shrink-0">
                  {SEGS.map(s => (
                    <button key={s.key} disabled={busy === p.mpId}
                      onClick={() => setSegment(p, s.key)}
                      className={`px-2 py-0.5 text-xs ${ (p.segment || "all") === s.key
                        ? "bg-gold text-deep" : "bg-card hover:bg-wgray"}`}>
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

// 배지 2: 솔리드 서클 팀 배지 — 구단색 채움 + 밝은 색은 잉크 글자로 자동 대비
function TeamBadge({ team, colors, fallback }:
  { team: string; colors: Record<string, string>; fallback: string }) {
  const bg = resolveTeamColor(team, colors, fallback);
  const label = badgeLabel(team);
  return (
    <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-full grid place-items-center mx-auto mb-1.5 font-black leading-none select-none"
      style={{ background: bg, color: badgeTextColor(bg), fontSize: label.length >= 3 ? "9px" : "11px", letterSpacing: "-0.02em" }}
      aria-hidden="true">
      {label}
    </span>
  );
}

function StatusBadge({ status, dark = false }: { status: string; dark?: boolean }) {
  const light: Record<string, { label: string; cls: string }> = {
    scheduled: { label: "예정", cls: "bg-goldbg text-golddim" },
    live: { label: "진행중", cls: "bg-live/10 text-live" },
    finished: { label: "종료", cls: "bg-wgray text-wgraytx" },
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
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full align-middle ${s.cls}`}>
      {status === "live" && <span className="w-1.5 h-1.5 rounded-full bg-live animate-pulse" />}
      {s.label}
    </span>
  );
}

// 이긴 팀 점수는 잉크, 진 팀/미정은 감산
function scoreWin(mine: number | null, other: number | null): string {
  if (mine == null || other == null) return "text-wmute";
  return mine > other ? "text-ink" : "text-wmute";
}
// 패배한 쪽인지 (팀명 감산용)
function loserSide(mine: number | null, other: number | null): boolean {
  return mine != null && other != null && mine < other;
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
    <div className="flex items-center gap-2 mb-3 text-sm bg-wgray border rounded px-3 py-2">
      <span className="text-wsub text-xs">스코어</span>
      <span className="font-medium">{homeTeam}</span>
      <input type="number" min={0} max={99} value={h} onChange={e => setH(e.target.value)}
        className="w-12 border rounded px-1 py-0.5 text-center" placeholder="-" />
      <span className="text-wfaint">:</span>
      <input type="number" min={0} max={99} value={a} onChange={e => setA(e.target.value)}
        className="w-12 border rounded px-1 py-0.5 text-center" placeholder="-" />
      <span className="font-medium">{awayTeam}</span>
      <button onClick={save} disabled={busy || !changed}
        className="ml-auto text-xs px-3 py-1 rounded bg-gold text-deep disabled:opacity-40">
        {busy ? "저장중" : "저장"}
      </button>
    </div>
  );
}

// 관리자: 경기 시간 수정 (datetime-local 입력을 KST로 저장)
function DateEditor({ matchId, date, onChanged }:
  { matchId: string; date: string | Date; onChanged: () => void }) {
  // 저장된 시각(UTC)을 KST 벽시계로 변환해 datetime-local 기본값으로 사용
  const toKstLocal = (d: string | Date) =>
    new Date(new Date(d).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 16);
  const initial = toKstLocal(date);
  const [v, setV] = useState<string>(initial);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const res = await fetch(`/api/admin/match/${matchId}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: v }),
    });
    setBusy(false);
    if (!res.ok) { alert("저장 실패"); return; }
    onChanged();
  }

  return (
    <div className="flex items-center gap-2 mb-3 text-sm bg-wgray border rounded px-3 py-2">
      <span className="text-wsub text-xs">경기 시간</span>
      <input type="datetime-local" value={v} onChange={e => setV(e.target.value)}
        className="border rounded px-2 py-0.5" />
      <button onClick={save} disabled={busy || v === initial || !v}
        className="ml-auto text-xs px-3 py-1 rounded bg-gold text-deep disabled:opacity-40">
        {busy ? "저장중" : "저장"}
      </button>
    </div>
  );
}

// 관리자: 라운드/단계 라벨 수정 (예: "프리미어리그 7라운드", "KBO 플레이오프 2차전")
function RoundEditor({ matchId, sport, round, onChanged }:
  { matchId: string; sport: string; round: string | null; onChanged: () => void }) {
  const initial = round ?? "";
  const [v, setV] = useState<string>(initial);
  const [busy, setBusy] = useState(false);
  const presets = ROUND_PRESETS[sport] ?? [];

  async function save() {
    setBusy(true);
    const res = await fetch(`/api/admin/match/${matchId}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ round: v }),
    });
    setBusy(false);
    if (!res.ok) { alert("저장 실패"); return; }
    onChanged();
  }

  return (
    <div className="mb-3 text-sm bg-wgray border rounded px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="text-wsub text-xs shrink-0">라운드/단계</span>
        <input type="text" value={v} onChange={e => setV(e.target.value)}
          placeholder="예: 프리미어리그 7라운드"
          className="border rounded px-2 py-0.5 flex-1 min-w-0" />
        <button onClick={save} disabled={busy || v === initial}
          className="ml-auto shrink-0 text-xs px-3 py-1 rounded bg-gold text-deep disabled:opacity-40">
          {busy ? "저장중" : "저장"}
        </button>
      </div>
      {presets.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {presets.map(p => (
            <button type="button" key={p} onClick={() => setV(p)}
              className={`text-xs px-2 py-1 rounded-full border transition ${
                v === p ? "bg-gold text-deep border-gray-900" : "bg-card text-wsub border-wline hover:bg-wgray"}`}>
              {p}
            </button>
          ))}
          {v && (
            <button type="button" onClick={() => setV("")}
              className="text-xs px-2 py-1 rounded-full border border-dashed border-wline text-wfaint hover:bg-wgray">
              지우기
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// 관리자: LCK 세트별 승팀 입력 (세트 종료 후 직접 지정 → 총 스코어 자동 동기화)
function LckSetResults({ matchId, homeTeam, awayTeam, initial, onChanged }:
  { matchId: string; homeTeam: string; awayTeam: string;
    initial: Record<string, string>; onChanged: () => void }) {
  const [results, setResults] = useState<Record<string, string>>(initial || {});
  const [busy, setBusy] = useState(false);
  const SETS = ["set1", "set2", "set3", "set4", "set5"];

  async function setWin(setKey: string, side: "home" | "away") {
    const next = { ...results };
    if (next[setKey] === side) delete next[setKey]; else next[setKey] = side;
    setResults(next);
    setBusy(true);
    const res = await fetch(`/api/admin/match/${matchId}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ setResults: next }),
    });
    setBusy(false);
    if (!res.ok) { alert("저장 실패"); return; }
    onChanged();
  }

  const hw = Object.values(results).filter(v => v === "home").length;
  const aw = Object.values(results).filter(v => v === "away").length;

  return (
    <div className="mb-3 bg-wgray border rounded px-3 py-2.5 text-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-wsub text-xs">🎮 세트별 승팀</span>
        <span className="ml-auto font-semibold">{homeTeam} {hw} : {aw} {awayTeam}</span>
      </div>
      <div className="space-y-1.5">
        {SETS.map((sk, i) => (
          <div key={sk} className="flex items-center gap-2">
            <span className="text-xs text-wfaint w-10 shrink-0">{i + 1}세트</span>
            <div className="flex rounded overflow-hidden border flex-1">
              <button disabled={busy} onClick={() => setWin(sk, "home")}
                className={`flex-1 px-2 py-1 text-xs truncate ${results[sk] === "home" ? "bg-amber-500 text-white" : "bg-card hover:bg-wgray"}`}>
                {homeTeam}
              </button>
              <button disabled={busy} onClick={() => setWin(sk, "away")}
                className={`flex-1 px-2 py-1 text-xs truncate ${results[sk] === "away" ? "bg-red-500 text-white" : "bg-card hover:bg-wgray"}`}>
                {awayTeam}
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-wfaint mt-2">같은 버튼을 다시 누르면 미정으로 돌아갑니다. 승팀을 정하면 위 스코어가 자동 반영됩니다.</p>
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
      <span className="text-wsub text-xs">경기 상태:</span>
      <div className="flex rounded overflow-hidden border">
        {OPTS.map(o => (
          <button key={o.key} disabled={busy} onClick={() => setStatus(o.key)}
            className={`px-3 py-1 text-xs ${status === o.key ? "bg-gold text-deep" : "bg-card hover:bg-wgray"}`}>
            {o.label}
          </button>
        ))}
      </div>
      <span className="text-xs text-wfaint">진행중=전반/1세트만, 종료=전 구간 평점 가능</span>
    </div>
  );
}

// 평점 통계: 선수 순위 막대 + 팀별 평균 비교
function StatsPanel({ players, homeTeam, awayTeam, segLabel, teamColors = {} }:
  { players: Player[]; homeTeam: string; awayTeam: string; segLabel: string; teamColors?: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const hColor = resolveTeamColor(homeTeam, teamColors, DEFAULT_HOME);
  const aColor = resolveTeamColor(awayTeam, teamColors, DEFAULT_AWAY);

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

  // 팀 기준 색상 — 실제 구단색 막대
  const barColor = (team: string) =>
    team === homeTeam ? hColor : team === awayTeam ? aColor : "#b8b2a2";
  const pct = (v: number) => `${Math.max(0, Math.min(100, ((v - 1) / 9) * 100))}%`; // 1~10 범위를 0~100%로

  if (rated.length === 0) return null;

  return (
    <div className="mb-4 border border-wline rounded-xl bg-card overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex justify-between items-center px-4 py-2.5 text-sm font-bold text-ink hover:bg-paper">
        <span>평점 통계{segLabel ? ` · ${segLabel}` : ""}</span>
        <span className="text-wfaint">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-5">
          {/* 팀별 평균 비교 */}
          {(homeA || awayA) && (
            <div>
              <p className="text-xs font-semibold text-wsub mb-2">팀 평균 평점</p>
              <div className="space-y-2">
                {[{ t: homeTeam, d: homeA, c: hColor }, { t: awayTeam, d: awayA, c: aColor }].map(({ t, d, c }) => (
                  <div key={t} className="flex items-center gap-2">
                    <span className="w-20 shrink-0 text-xs truncate">{t}</span>
                    <div className="flex-1 bg-wgray rounded h-5 relative">
                      {d && <div className="h-5 rounded flex items-center justify-end pr-1.5" style={{ width: pct(d.avg), background: c }}>
                        <span className="text-[10px] text-white font-bold tabular-nums">{d.avg}</span>
                      </div>}
                    </div>
                    <span className="w-10 shrink-0 text-[10px] text-wfaint text-right">{d ? `${d.n}명` : "-"}</span>
                  </div>
                ))}
              </div>
              {homeA && awayA && (
                <p className="text-xs text-wsub mt-1.5 text-center">
                  {homeA.avg > awayA.avg ? `${homeTeam}` : awayA.avg > homeA.avg ? `${awayTeam}` : "양 팀"}
                  {homeA.avg === awayA.avg ? " 평점 동일" : ` 우세 (+${Math.abs(homeA.avg - awayA.avg).toFixed(2)})`}
                </p>
              )}
            </div>
          )}

          {/* 선수 순위 막대 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-wsub">선수 평점 순위 (베스트 → 워스트)</p>
              <div className="flex gap-2 text-[10px] text-wfaint">
                <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: hColor }} />{homeTeam}</span>
                <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: aColor }} />{awayTeam}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              {ranked.map((p, i) => (
                <div key={p.mpId} className="flex items-center gap-2">
                  <span className="w-4 shrink-0 text-[10px] text-wfaint text-right tabular-nums">{i + 1}</span>
                  <span className="w-16 shrink-0 text-xs truncate">{p.name}</span>
                  <div className="flex-1 bg-wgray rounded h-5">
                    <div className="h-5 rounded flex items-center justify-end pr-1.5" style={{ width: pct(p.avg), background: barColor(p.team) }}>
                      <span className="text-[10px] text-white font-bold tabular-nums">{p.avg}</span>
                    </div>
                  </div>
                  <span className="w-8 shrink-0 text-[10px] text-wfaint text-right">{p.count}명</span>
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
    return <p className="text-sm text-wsub mb-4">로그인 후 이용할 수 있습니다.</p>;

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
    <div className="flex items-center justify-between mb-3 bg-goldbg border border-goldline rounded-xl px-3.5 py-2.5">
      <p className="text-sm font-bold text-ink inline-flex items-center gap-1.5 flex-wrap">
        <GoldStar className="w-3.5 h-3.5" /> 나의 평점
        {count > 0 && data?.top
          ? <span className="font-normal text-golddim"> · 내 최고 평점 <b className="text-ink">{data.top.name}</b> {data.top.score}</span>
          : count > 0
          ? <span className="font-normal text-golddim"> · {count}명 평가</span>
          : <span className="font-normal text-golddim"> · 선수를 눌러 평점을 남겨보세요</span>}
      </p>
      {count > 0 && (
        <button onClick={share} className="text-sm font-bold px-3.5 py-1.5 rounded-full bg-ink text-paper shrink-0">
          {copied ? "✓ 복사됨" : "공유"}
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
          className="text-xs px-2 py-1 border border-wline rounded bg-card text-golddim hover:bg-goldbg">
          토론 주제 직접 입력
        </button>
      </div>
    );
  }

  return (
    <div className="bg-card border border-wline border-l-4 border-l-gold rounded-xl p-3.5 mb-4">
      {editing ? (
        <div className="space-y-2">
          <textarea value={text} onChange={e => setText(e.target.value)} maxLength={300}
            placeholder="토론 주제를 입력하세요 (비우면 삭제됩니다)"
            className="w-full border border-wline rounded p-2 text-sm h-20 bg-card" />
          <div className="flex gap-2 justify-end">
            <span className="text-[11px] text-wfaint mr-auto self-center">{text.length}/300</span>
            <button onClick={() => { setText(seed || ""); setEditing(false); }}
              className="text-xs px-3 py-1 border border-wline rounded bg-card">취소</button>
            <button onClick={save} disabled={busy}
              className="text-xs px-3 py-1 rounded bg-ink text-paper disabled:opacity-40">저장</button>
          </div>
        </div>
      ) : (
        <div className="flex justify-between items-start gap-2">
          <div>
            <p className="text-[10.5px] font-extrabold tracking-widest text-golddim mb-0.5">오늘의 토론</p>
            <p className="text-sm text-ink font-medium">{seed}</p>
          </div>
          {isAdmin && (
            <button onClick={() => { setText(seed || ""); setEditing(true); }}
              className="text-[11px] text-wfaint shrink-0 hover:underline hover:text-ink">수정</button>
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
    <div className="mt-3 border-t border-dashed border-wline pt-3">
      <button onClick={() => setOpen(!open)} className="text-xs font-bold text-wsub mb-2 hover:text-ink">
        토론 {items.length > 0 ? `(${items.length})` : ""} {open ? "▲" : "▼"}
      </button>

      {open && (
        <>
          {/* 입력 */}
          {loggedIn ? (
            <div className="flex gap-1.5 mb-3">
              <input value={text} onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") submit(); }}
                placeholder="이 경기에 대한 의견을 남겨보세요"
                maxLength={500}
                className="flex-1 border border-wline rounded-full px-3 py-1.5 text-sm bg-paper" />
              <button onClick={submit} disabled={busy || !text.trim()}
                className="text-sm font-bold px-3.5 bg-ink text-gold rounded-full disabled:opacity-40">등록</button>
            </div>
          ) : (
            <p className="text-xs text-wsub mb-3">로그인하면 토론에 참여할 수 있습니다.</p>
          )}

          {/* 목록 */}
          <div className="space-y-1.5">
            {items.length === 0 && <p className="text-xs text-wfaint">첫 댓글을 남겨보세요!</p>}
            {items.map(c => (
              <div key={c.id} className="bg-paper border border-wsoft rounded-lg px-2.5 py-1.5">
                <div className="flex justify-between items-start gap-2">
                  <Author id={c.userId} name={c.username} className="text-[11px] text-wsub" />
                  <div className="flex gap-2 shrink-0">
                    {isAdmin && (c.blinded
                      ? <button onClick={() => setBlind(c.id, false)} className="text-[10px] text-green-600">복구</button>
                      : <button onClick={() => setBlind(c.id, true)} className="text-[10px] text-golddim">블라인드</button>)}
                    {(isAdmin || c.mine) && (
                      <button onClick={() => remove(c.id)} className="text-[10px] text-red-400">삭제</button>
                    )}
                  </div>
                </div>

                {c.blinded
                  ? <p className="text-sm text-wfaint italic">🚫 신고 누적으로 가려진 댓글입니다.</p>
                  : <p className="text-sm whitespace-pre-wrap break-words">{c.text}</p>}

                {/* 액션 바 */}
                {!c.blinded && (
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-wfaint">
                    <button onClick={() => like(c.id)} className="hover:text-ink">👍 {c.likes > 0 ? c.likes : ""}</button>
                    <button onClick={() => { setReplyOn(replyOn === c.id ? null : c.id); setReplyText(""); }} className="hover:text-ink">답글 {c.replies.length > 0 ? c.replies.length : ""}</button>
                    {!c.mine && (
                      <button onClick={() => report(c.id)} className={`hover:text-live ${c.reportedByMe ? "text-live" : ""}`}>
                        {c.reportedByMe ? "신고됨" : "신고"}
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
                      className="flex-1 border border-wline rounded px-2 py-1 text-xs bg-card" />
                    <button onClick={() => submitReply(c.id)} disabled={!replyText.trim()}
                      className="text-xs px-2 bg-ink text-paper rounded disabled:opacity-40">등록</button>
                  </div>
                )}

                {/* 답글 목록 */}
                {c.replies.length > 0 && (
                  <div className="mt-2 space-y-1 pl-3 border-l-2 border-wline">
                    {c.replies.map((r: any) => (
                      <div key={r.id} className="text-xs">
                        <Author id={r.userId} name={r.username} className="text-wfaint" />{" "}
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

const RECORD_META: Record<string, { title: string; placeholder: string }> = {
  kbo: {
    title: "주요 기록 (홈런 · 타점 등)",
    placeholder: "한 줄에 하나씩 입력\n예) 3회 오스틴 2점 홈런\n7회 김현수 결승 적시타\n9회 유영찬 세이브",
  },
  lck: {
    title: "주요 기록",
    placeholder: "한 줄에 하나씩 입력\n예) 1세트 페이커 펜타킬\n2세트 오너 갱킹 주도",
  },
  default: {
    title: "골 · 어시스트 기록",
    placeholder: "한 줄에 하나씩 입력\n예) 23' 손흥민 (도움: 이강인)\n67' 주민규 (PK)",
  },
};

function MatchRecord({ matchId, record, sport }: { matchId: string; record?: string | null; sport?: string }) {
  const { data: session } = useSession();
  const router = useRouter();
  const isAdmin = (session?.user as any)?.role === "admin";
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(record || "");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const meta = RECORD_META[sport || ""] ?? RECORD_META.default;

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

  // EPL 자동 경기: 골 기록(득점 시간·득점자·도움)을 API에서 자동으로 불러오기
  async function syncGoals() {
    setSyncing(true);
    const res = await fetch(`/api/admin/epl/sync-goals`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ matchId }),
    });
    const j = await res.json().catch(() => ({}));
    setSyncing(false);
    if (!res.ok || j.ok === false) { alert(j.message || j.error || "불러오기 실패"); return; }
    router.refresh();
  }

  return (
    <div className="bg-card border border-wline rounded-xl p-3 mb-4 text-sm max-w-md">
      <div className="flex justify-between items-center mb-1">
        <span className="font-bold text-ink">{meta.title}</span>
        <div className="flex items-center gap-2">
          {isAdmin && sport === "epl" && !editing && (
            <button onClick={syncGoals} disabled={syncing}
              className="text-xs text-blue-600 hover:underline disabled:opacity-40">
              {syncing ? "불러오는 중…" : "⚽ 골 자동 불러오기"}</button>
          )}
          {isAdmin && !editing && (
            <button onClick={() => { setText(record || ""); setEditing(true); }}
              className="text-xs text-ink hover:underline">{record ? "수정" : "+ 입력"}</button>
          )}
        </div>
      </div>
      {editing ? (
        <div>
          <textarea value={text} onChange={e => setText(e.target.value)}
            className="w-full border rounded p-2 h-24 text-sm"
            placeholder={meta.placeholder}/>
          <div className="flex gap-2 justify-end mt-1">
            <button onClick={() => setEditing(false)} className="px-3 py-1 border rounded text-xs">취소</button>
            <button onClick={save} disabled={saving}
              className="px-3 py-1 bg-gold text-deep rounded text-xs disabled:opacity-40">저장</button>
          </div>
        </div>
      ) : record ? (
        <ul className="space-y-0.5">
          {record.split("\n").filter(Boolean).map((line, i) => (
            <li key={i} className="text-wgraytx">{line}</li>
          ))}
        </ul>
      ) : (
        <p className="text-wfaint text-xs">아직 기록이 없습니다.</p>
      )}
    </div>
  );
}

// ⚡ 전체 평점 한번에 (축구) — 필드 밑 접이식. 구간 선택 후 선수 전원을 인라인으로 일괄 등록.
function BulkRatePanel({ home, away, homeTeam, awayTeam, matchId, sport, segments, status, teamColors = {}, loggedIn, onSaved }:
  { home: Player[]; away: Player[]; homeTeam: string; awayTeam: string; matchId: string;
    sport: string; segments: { key: string; label: string }[]; status: string;
    teamColors?: Record<string, string>; loggedIn: boolean; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const ratable = segments.filter(s => s.key !== "full");
  const firstRatable = ratable[0]?.key;
  const [seg, setSeg] = useState("full");
  const [scores, setScores] = useState<Record<string, Record<string, number | null>>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const segLocked = (key: string) => {
    if (key === "full") return false;
    if (status === "finished") return false;
    if (status === "live") return key !== firstRatable;
    return true;
  };

  async function loadMine() {
    if (!loggedIn) return;
    try {
      const r = await fetch(`/api/my-ratings?matchId=${matchId}`);
      const j = await r.json();
      const map: Record<string, Record<string, number>> = {};
      for (const it of (j.items || [])) (map[it.segment] ||= {})[it.playerId] = it.score;
      setScores(map);
    } catch {}
  }
  useEffect(() => { if (open) loadMine(); /* eslint-disable-next-line */ }, [open]);

  const cur = scores[seg] || {};
  const setScore = (pid: string, n: number) =>
    setScores(m => ({ ...m, [seg]: { ...(m[seg] || {}), [pid]: (m[seg]?.[pid] === n ? null : n) } }));
  const count = Object.values(cur).filter(v => v != null).length;

  async function submit() {
    if (!loggedIn) { setMsg("로그인이 필요합니다."); return; }
    const items = Object.entries(cur)
      .filter(([, sc]) => sc != null)
      .map(([pid, sc]) => ({ playerId: pid, segment: seg, score: sc as number }));
    if (items.length === 0) { setMsg("점수를 선택한 선수가 없습니다."); return; }
    setBusy(true);
    const res = await fetch("/api/rating/bulk", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ matchId, items }),
    });
    setBusy(false);
    const j = await res.json();
    if (!res.ok) { setMsg(j.error || "등록 실패"); return; }
    setMsg(`${j.saved}명 등록 완료!`);
    onSaved();
  }

  const Col = ({ team, list, color }: { team: string; list: Player[]; color: string }) => (
    <div>
      <p className="flex items-center gap-1.5 text-[12px] font-extrabold mb-1.5">
        <span className="w-2 h-2 rounded-full" style={{ background: color }} />{team}
      </p>
      <div className="space-y-1">
        {list.map(p => {
          const v = cur[p.playerId] ?? null;
          return (
            <div key={p.mpId} className="flex items-center gap-2">
              <span className="text-[12.5px] font-bold text-ink w-16 sm:w-20 shrink-0 truncate">{p.name}</span>
              <div className="flex-1 grid grid-cols-10 gap-0.5">
                {[1,2,3,4,5,6,7,8,9,10].map(n => {
                  const on = v === n;
                  return (
                    <button key={n} onClick={() => setScore(p.playerId, n)}
                      className={`h-7 rounded text-[11px] font-extrabold transition ${on ? "text-white" : "border border-wsoft text-wmute hover:text-wsub"}`}
                      style={on ? scoreChipStyle(n) : undefined}>{n}</button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const hColor = resolveTeamColor(homeTeam, teamColors, DEFAULT_HOME);
  const aColor = resolveTeamColor(awayTeam, teamColors, DEFAULT_AWAY);

  return (
    <div className="mt-3 border border-goldline rounded-2xl bg-goldbg/40 overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left">
        <span className="text-[14px] font-extrabold text-golddim">⚡ 전체 평점 한번에</span>
        <span className="text-[11px] text-wfaint font-semibold hidden sm:inline">선수 전원을 한 화면에서 — 한 번에 등록</span>
        <span className="ml-auto text-wfaint">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-goldline/60">
          {/* 구간 선택 */}
          <div className="flex gap-1.5 my-3 flex-wrap">
            {segments.map(s => {
              const locked = segLocked(s.key);
              return (
                <button key={s.key} disabled={locked} onClick={() => setSeg(s.key)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                    seg === s.key ? "bg-gold text-deep" : "bg-card border border-wline text-wsub"} ${locked ? "opacity-40 cursor-not-allowed" : ""}`}>
                  {locked ? "🔒 " : ""}{s.key === "full" ? "총평" : s.label}
                </button>
              );
            })}
            <span className="ml-auto self-center text-[11px] text-wfaint font-semibold">
              {seg === "full" ? "경기 전체를 한 점수로" : `${segments.find(s=>s.key===seg)?.label} 점수`}
            </span>
          </div>

          <div className="grid sm:grid-cols-2 gap-x-5 gap-y-3">
            <Col team={homeTeam} list={home} color={hColor} />
            <Col team={awayTeam} list={away} color={aColor} />
          </div>

          <div className="flex items-center gap-3 mt-4 pt-3 border-t border-wsoft">
            <span className="text-[11.5px] text-wsub font-semibold">
              선택한 <b className="text-golddim">{count}</b>명만 등록 · 이미 매긴 점수는 채워져 있어요
            </span>
            <button onClick={submit} disabled={busy || count === 0}
              className="ml-auto bg-gold text-deep font-black text-[13px] px-5 py-2 rounded-lg disabled:opacity-40">
              {count > 0 ? `${count}명 등록` : "등록"}
            </button>
          </div>
          {msg && <p className="text-[13px] mt-2 text-golddim font-semibold">{msg}</p>}
        </div>
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

  // M안(S1): 총평(full)이 기본 입력, 세트/전후반은 접이식 상세
  void segment; // (구 진입 구간 자동선택 로직 제거 — 총평 기본)
  const [full, setFull] = useState<number | null>(null);
  const [segScores, setSegScores] = useState<Record<string, number | null>>({});
  const [comment, setComment] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<any>(null);
  const fullLocked = status === "scheduled";

  async function load() {
    const r = await fetch(`/api/player-ratings?matchId=${matchId}&playerId=${player.playerId}`);
    setData(await r.json());
  }
  // 내 기존 평점 프리필 (총평 + 구간별)
  async function loadMine() {
    if (!loggedIn) return;
    try {
      const r = await fetch(`/api/my-ratings?matchId=${matchId}`);
      const j = await r.json();
      const mine = (j.items || []).filter((it: any) => it.playerId === player.playerId);
      const segs: Record<string, number | null> = {};
      let f: number | null = null, c = "";
      for (const it of mine) {
        if (it.segment === "full") { f = it.score; c = it.comment || ""; }
        else segs[it.segment] = it.score;
      }
      setFull(f); setSegScores(segs); setComment(c);
      if (Object.keys(segs).length > 0) setDetailOpen(true);
    } catch {}
  }
  useEffect(() => { load(); loadMine(); /* eslint-disable-next-line */ }, []);

  async function submit() {
    const items: { playerId: string; segment: string; score: number; comment?: string }[] = [];
    if (full !== null && !fullLocked) items.push({ playerId: player.playerId, segment: "full", score: full, comment });
    for (const s of ratableSegs) {
      const sc = segScores[s.key];
      if (sc != null && !segLocked(s.key)) items.push({ playerId: player.playerId, segment: s.key, score: sc });
    }
    if (items.length === 0) { setMsg("총평 또는 구간 점수를 선택하세요."); return; }
    setBusy(true);
    const res = await fetch("/api/rating/bulk", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ matchId, items }),
    });
    setBusy(false);
    const j = await res.json();
    if (!res.ok) { setMsg(j.error || "등록 실패"); return; }
    setMsg("등록 완료!");
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
      <div className="bg-card rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b sticky top-0 bg-card flex justify-between">
          <div>
            <h3 className="text-xl font-bold">{player.name}</h3>
            <p className="text-sm text-wsub">{player.team} · {player.role}</p>
            {data && <p className="text-sm mt-1 inline-flex items-center gap-1">전체 평균 <GoldStar className="w-3.5 h-3.5" /> <b className="tabular-nums">{data.avg}</b> ({data.count}명)</p>}
          </div>
          <div className="flex items-start gap-2">
            {data && (
              <ShareButton
                title={`${player.name} 팬 평점 ⭐ ${data.avg}`}
                text={`${player.team} ${player.name} — fanarena.kr 팬 평점 ${data.avg}점 (${data.count}명)`}
                path={`/${sportPath(sport)}/${matchId}`}
                label="공유" />
            )}
            <button onClick={onClose} className="text-2xl leading-none">×</button>
          </div>
        </div>

        <div className="p-5 border-b">
          {loggedIn ? (
            fullLocked ? (
              <p className="text-sm text-golddim bg-goldbg border border-goldline rounded p-3">🔒 {lockMsg}</p>
            ) : (
              <>
                {/* 총평 — 기본 입력 (한 번이면 등록 끝) */}
                <p className="text-sm font-semibold mb-2">이 경기 총평 <span className="text-xs font-normal text-wfaint">(1~10)</span></p>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-1 mb-3">
                  {[1,2,3,4,5,6,7,8,9,10].map(n => {
                    const on = full === n;
                    return (
                      <button key={n} onClick={() => setFull(on ? null : n)}
                        className={`h-10 rounded-lg text-sm font-bold transition ${on ? "border-2 border-ink" : "border border-wline bg-card text-wfaint hover:text-wsub"}`}
                        style={on ? scoreChipStyle(n) : undefined}>
                        {n}
                      </button>
                    );
                  })}
                </div>

                {/* 세트/전후반 상세 — 접이식 선택 옵션 */}
                {ratableSegs.length > 0 && (
                  <div className="mb-3">
                    <button type="button" onClick={() => setDetailOpen(v => !v)}
                      className={`w-full flex items-center gap-2 border border-dashed rounded-lg px-3 py-2 text-xs font-bold transition ${
                        detailOpen ? "border-goldline border-solid text-golddim rounded-b-none" : "border-wline text-wfaint hover:text-wsub"}`}>
                      🎛 {sport === "lck" ? "세트별로" : "전·후반"} 다르게 매기기 <span className="font-normal">(선택)</span>
                      <span className="ml-auto">{detailOpen ? "▴" : "▾"}</span>
                    </button>
                    {detailOpen && (
                      <div className="border border-t-0 border-goldline rounded-b-lg divide-y divide-wsoft">
                        {ratableSegs.map(s => {
                          const locked = segLocked(s.key);
                          const cur = segScores[s.key] ?? null;
                          return (
                            <div key={s.key} className="flex items-center gap-2 px-2.5 py-2">
                              <span className="w-12 text-xs font-bold shrink-0">{s.label}</span>
                              {locked ? (
                                <span className="text-[11px] text-wfaint">🔒 종료 후 입력</span>
                              ) : (
                                <>
                                  <div className="flex-1 grid grid-cols-10 gap-0.5">
                                    {[1,2,3,4,5,6,7,8,9,10].map(n => {
                                      const on = cur === n;
                                      return (
                                        <button key={n} onClick={() => setSegScores(m => ({ ...m, [s.key]: on ? null : n }))}
                                          className={`h-7 rounded text-[11px] font-extrabold transition ${on ? "text-white" : "border border-wsoft text-wmute hover:text-wsub"}`}
                                          style={on ? scoreChipStyle(n) : undefined}>{n}</button>
                                      );
                                    })}
                                  </div>
                                  {cur != null
                                    ? <button onClick={() => setSegScores(m => ({ ...m, [s.key]: null }))} className="text-wfaint hover:text-live text-sm shrink-0 w-4" title="지우기">✕</button>
                                    : <span className="w-4 shrink-0" />}
                                </>
                              )}
                            </div>
                          );
                        })}
                        <p className="px-3 py-1.5 text-[10.5px] text-wfaint">미입력 구간은 총평만 반영됩니다.</p>
                      </div>
                    )}
                  </div>
                )}

                <textarea value={comment} onChange={e=>setComment(e.target.value)}
                  placeholder="코멘트 (선택 · 총평에 함께 저장)"
                  className="w-full border rounded p-2 h-20 text-sm"/>
                <p className="text-[11px] text-wfaint mt-1 leading-snug">
                  특정인(선수·감독·심판 등 포함)에 대한 과도한 욕설·비방·모욕, 근거 없는 명예훼손은
                  통보 없이 삭제될 수 있습니다. 평점·코멘트는 작성자 개인의 의견입니다.
                </p>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-wsub">{comment.length}자</span>
                  <button onClick={submit} disabled={busy}
                    className="bg-gold text-deep px-4 py-1.5 rounded font-bold disabled:opacity-40">등록</button>
                </div>
                {msg && <p className="text-sm mt-2 text-golddim">{msg}</p>}
              </>
            )
          ) : <p className="text-sm text-wsub">로그인 후 평점을 등록할 수 있습니다.</p>}
        </div>

        <div className="p-5">
          <h4 className="font-semibold mb-3">코멘트 {data ? `(${data.comments.length})` : ""}</h4>
          {!data && <p className="text-sm text-wfaint">불러오는 중...</p>}
          {data && data.comments.length === 0 && <p className="text-sm text-wfaint">아직 코멘트가 없습니다.</p>}
          {top3.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-golddim font-bold mb-1">인기 코멘트</p>
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
    <div className={`border rounded p-3 mb-2 ${highlight && !c.blinded ? "bg-goldbg border-goldline" : ""} ${c.blinded ? "bg-wgray border-wline" : ""}`}>
      <div className="flex justify-between text-xs text-wsub mb-1">
        <span className="inline-flex items-center gap-1.5"><Author id={c.userId} name={c.username} />
          <span className="inline-flex items-center justify-center min-w-[20px] h-[18px] px-1 rounded-md text-[11px] font-extrabold" style={scoreChipStyle(c.score)}>{c.score}</span>
          {isAdmin && c.reportCount > 0 ? <span className="text-red-500">🚩 {c.reportCount}</span> : null}</span>
        {!c.blinded && <button onClick={onLike} className="hover:text-red-500">👍 {c.likes}</button>}
      </div>

      {hidden ? (
        <p className="text-sm text-wfaint italic">
          🚫 신고가 누적되어 가려진 코멘트입니다.
          <button onClick={() => setRevealed(true)} className="ml-2 text-blue-500 underline not-italic">보기</button>
        </p>
      ) : (
        <>
          {c.blinded && (
            <p className="text-xs text-golddim mb-1">🚫 {isAdmin ? "신고 누적으로 자동 블라인드됨" : "신고에 의해 가려진 코멘트"}</p>
          )}
          <p className="text-sm whitespace-pre-wrap">{c.text}</p>
        </>
      )}

      <div className="mt-1 flex items-center gap-3">
        <button
          onClick={() => loggedIn ? setReplyOpen(!replyOpen) : alert("로그인이 필요합니다.")}
          className="text-xs text-wfaint hover:text-ink">
          💬 답글{replies.length > 0 ? ` ${replies.length}` : ""}
        </button>
        {!c.mine && (
          <button onClick={report} disabled={busy || c.reportedByMe}
            className="text-xs text-wfaint hover:text-red-500 disabled:opacity-40">
            🚩 {c.reportedByMe ? "신고됨" : "신고"}
          </button>
        )}
        {isAdmin && (
          <>
            {c.blinded
              ? <button onClick={() => setBlind(false)} disabled={busy} className="text-xs text-green-600 hover:underline">복구</button>
              : <button onClick={() => setBlind(true)} disabled={busy} className="text-xs text-golddim hover:underline">블라인드</button>}
            <button onClick={removeComment} disabled={busy} className="text-xs text-red-500 hover:underline">삭제</button>
          </>
        )}
      </div>

      {replies.length > 0 && !hidden && (
        <div className="mt-2 space-y-1.5 border-l-2 border-wline pl-3">
          {replies.map(r => (
            <div key={r.id} className="text-sm">
              <span className="text-xs text-wsub mr-1.5">↳ <Author id={r.userId} name={r.username} /></span>
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
            className="text-xs px-3 bg-gold text-deep rounded disabled:opacity-40">등록</button>
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
      <div className="bg-card rounded-xl max-w-md w-full p-5 space-y-3" onClick={e => e.stopPropagation()}>
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
            className={`flex-1 py-2 rounded-lg border text-sm font-bold ${starter ? "bg-gold text-deep border-gray-900" : "bg-card text-wsub"}`}>
            ⚽ 선발 (피치)
          </button>
          <button type="button" onClick={() => setStarter(false)}
            className={`flex-1 py-2 rounded-lg border text-sm font-bold ${!starter ? "bg-gold text-deep border-gray-900" : "bg-card text-wsub"}`}>
            🔁 후보/교체
          </button>
        </div>

        {/* 선발이면 역할군 선택 */}
        {starter && (
          <div>
            <p className="text-xs text-wsub mb-1.5">역할군 (등록 후 드래그하면 그 위치의 세부 포지션으로 자동 변경)</p>
            <div className="grid grid-cols-4 gap-1.5">
              {GROUPS.map(g => (
                <button key={g.key} type="button" onClick={() => setGroup(g.key)}
                  className={`py-2 rounded-lg border text-xs font-bold ${group === g.key ? "bg-amber-500 text-white border-amber-500" : "bg-card text-wsub"}`}>
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
          <button onClick={submit} className="px-4 py-1.5 bg-gold text-deep rounded">추가</button>
        </div>
      </div>
    </div>
  );
}
