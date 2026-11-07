"use client";
import { useEffect, useState } from "react";
import type { Player } from "./types";
import RatingSlider from "./RatingSlider";
import { normalizeLane } from "@/lib/lckLanes";
import { GoldStar } from "@/app/MatchCard";
import { teamColor, DEFAULT_HOME, DEFAULT_AWAY } from "@/lib/teamColors";
import { scoreChipStyle } from "@/lib/scoreColor";

// POG/POM 골드 배지 (👑 이모지 대체)
function PogBadge({ kind }: { kind: "POG" | "POM" }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-[8px] font-extrabold text-golddim bg-goldbg border border-goldline rounded px-1 py-px shrink-0">
      <GoldStar className="w-2 h-2" />{kind}
    </span>
  );
}

export const LANE_ORDER = ["TOP", "JGL", "MID", "ADC", "SPT"];
const LANE_LABEL: Record<string, string> = {
  TOP: "탑", JGL: "정글", MID: "미드", ADC: "원딜", SPT: "서폿",
};

export function laneOf(p: Player): string {
  return normalizeLane(p.role);
}

function sortByLane(players: Player[]): Player[] {
  return [...players].sort((a, b) => {
    const ia = LANE_ORDER.indexOf(laneOf(a));
    const ib = LANE_ORDER.indexOf(laneOf(b));
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

export function LckOverallRatings({ home, away, homeTeam, awayTeam, matchId, revision, onPick, onSaved }:
  { home: Player[]; away: Player[]; homeTeam: string; awayTeam: string; matchId: string; revision: number;
    onPick: (player: Player) => void; onSaved: () => void }) {
  const [saved, setSaved] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [vibrate, setVibrate] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/my-ratings?matchId=${encodeURIComponent(matchId)}`, { signal: controller.signal })
      .then(async res => {
        if (!res.ok) throw new Error();
        const data = await res.json();
        const scores: Record<string, number> = {};
        for (const item of data.items ?? []) if (item.segment === "full") scores[item.playerId] = item.score;
        if (!controller.signal.aborted) setSaved(scores);
      })
      .catch(() => { if (!controller.signal.aborted) setMessage("기존 평점을 불러오지 못했습니다."); });
    return () => controller.abort();
  }, [matchId, revision]);

  const items = Array.from(new Set([...home, ...away].map(p => p.playerId)))
    .filter(id => draft[id] != null && draft[id] !== saved[id])
    .map(playerId => ({ playerId, segment: "full", score: draft[playerId] }));

  async function submit() {
    if (busy || items.length === 0) return;
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/rating/bulk", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ matchId, items }),
      });
      const data = await res.json();
      if (!res.ok) { setMessage(data.error || "평점 등록에 실패했습니다."); return; }
      const updates = Object.fromEntries(items.map(item => [item.playerId, item.score]));
      setSaved(current => ({ ...current, ...updates }));
      setDraft({});
      setMessage(`${data.saved}명 총평 등록 완료`);
      onSaved();
    } catch {
      setMessage("평점 등록에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="LoL 라인업 총평" className="rounded-2xl border border-wline bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="font-extrabold text-ink">라인업 평점 <span className="text-xs font-semibold text-wsub">· LoL 총평</span></h3>
        <label className="text-xs text-wsub flex items-center gap-1.5"><input type="checkbox" checked={vibrate} onChange={e => setVibrate(e.target.checked)} />정수 진동</label>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {[{ team: homeTeam, players: home }, { team: awayTeam, players: away }].map(({ team, players }) => (
          <div key={team}>
            <h4 className="text-base font-extrabold text-ink mb-1">{team} 라인업</h4>
            <div className="divide-y divide-wline">
              {sortByLane(players).map(p => (
                <div key={p.mpId} className="py-2">
                  <RatingSlider label={`${p.name} · ${LANE_LABEL[laneOf(p)] ?? p.role}`} score={draft[p.playerId] ?? saved[p.playerId] ?? null}
                    disabled={busy} vibrate={vibrate} onChange={score => {
                      setDraft(current => ({ ...current, [p.playerId]: score }));
                      setMessage("");
                    }}
                    onClear={draft[p.playerId] == null ? undefined : () => setDraft(current => {
                      const next = { ...current };
                      delete next[p.playerId];
                      return next;
                    })}
                    action={<button type="button" disabled={busy} onClick={() => onPick(p)} className="text-xs text-wsub hover:text-ink underline"
                      aria-label={`${p.name} 평점 상세`}>상세</button>} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button type="button" disabled={busy || items.length === 0} onClick={submit}
        className="mt-3 w-full min-h-11 rounded-xl bg-gold text-deep font-extrabold disabled:opacity-40">
        {busy ? "등록 중…" : items.length ? `${items.length}명 평점 등록` : "평점 등록"}
      </button>
      {message && <p role="status" className="mt-2 text-sm text-golddim">{message}</p>}
    </section>
  );
}

export type Highlight = { playerId: string; kind: "POG" | "POM" } | null;

// 세트 탭일 때만 해당 세트의 챔피언
function champOf(p: Player, seg?: string): string | undefined {
  if (!seg || !/^set[1-5]$/.test(seg)) return undefined;
  return p.champions?.[seg];
}
function hlOf(p: Player, highlight?: Highlight): "POG" | "POM" | null {
  return highlight && highlight.playerId === p.playerId ? highlight.kind : null;
}

function Row({ p, onPick, seg, highlight }:
  { p: Player; onPick: (pl: Player) => void; seg?: string; highlight?: Highlight }) {
  const lane = laneOf(p);
  const champ = champOf(p, seg);
  const hl = hlOf(p, highlight);
  return (
    <button onClick={() => onPick(p)}
      className={`w-full bg-card border border-wline rounded-lg p-2.5 flex items-center gap-2 hover:border-ink hover:shadow-sm transition text-left ${
        hl ? "border-goldline ring-1 ring-gold/60" : ""}`}>
      <span className="text-[10px] font-bold w-9 text-center py-0.5 rounded bg-ink text-paper shrink-0">
        {lane === "ETC" ? (p.role || "?") : lane}
      </span>
      <span className="flex-1 min-w-0 flex items-center gap-1.5">
        <span className="font-semibold text-sm truncate">{p.name}</span>
        {champ && <span className="text-[11px] text-wfaint truncate shrink-0">{champ}</span>}
        {hl && <PogBadge kind={hl} />}
      </span>
      <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full shrink-0 tabular-nums ${p.avg !== null ? "" : "bg-wgray text-wfaint"}`}
        style={p.avg !== null ? scoreChipStyle(p.avg) : undefined}>
        {p.avg !== null ? p.avg : "－"}
      </span>
    </button>
  );
}

export default function LckLineup({ home, away, homeTeam, awayTeam, onPick, seg, highlight }:
  { home: Player[]; away: Player[]; homeTeam: string; awayTeam: string;
    onPick: (p: Player) => void; seg?: string; highlight?: Highlight }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div>
        <h3 className="font-bold mb-2 flex items-center gap-1.5 text-ink">
          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: teamColor(homeTeam, undefined, DEFAULT_HOME) }} />{homeTeam}
        </h3>
        <div className="space-y-1.5">{sortByLane(home).map(p => <Row key={p.mpId} p={p} onPick={onPick} seg={seg} highlight={highlight} />)}</div>
      </div>
      <div>
        <h3 className="font-bold mb-2 flex items-center gap-1.5 text-ink">
          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: teamColor(awayTeam, undefined, DEFAULT_AWAY) }} />{awayTeam}
        </h3>
        <div className="space-y-1.5">{sortByLane(away).map(p => <Row key={p.mpId} p={p} onPick={onPick} seg={seg} highlight={highlight} />)}</div>
      </div>
    </div>
  );
}

// 라인 대결 비교: TOP↔TOP, JGL↔JGL … 맞라인 평점 비교 + 👑
export function LckMatchup({ home, away, homeTeam, awayTeam, onPick, seg, highlight }:
  { home: Player[]; away: Player[]; homeTeam: string; awayTeam: string;
    onPick: (p: Player) => void; seg?: string; highlight?: Highlight }) {
  const byAvg = (a: Player, b: Player) => (b.avg ?? -1) - (a.avg ?? -1);

  // 한쪽 셀 (이름 + 챔피언 + 평점 배지) — 승자는 골드 스퀘어 + 잉크 테두리
  const Cell = ({ p, side, win }: { p?: Player; side: "home" | "away"; win: boolean }) => {
    const isHome = side === "home";
    const rated = p && p.avg !== null;
    const base = `flex-1 relative flex items-center gap-2 px-3 py-2.5 overflow-hidden ${isHome ? "justify-end" : "flex-row-reverse justify-end"}`;
    if (!p) return <div className={base}><span className="text-[13px] text-wmute italic">—</span></div>;
    const champ = champOf(p, seg);
    const hl = hlOf(p, highlight);
    return (
      <button onClick={() => onPick(p)} className={base}>
        {win && (
          <span className={`absolute inset-y-0 w-2/3 opacity-[0.15] ${isHome
            ? "right-0 bg-gradient-to-l from-gold to-transparent"
            : "left-0 bg-gradient-to-r from-gold to-transparent"}`} />
        )}
        <span className={`relative z-10 flex flex-col min-w-0 ${isHome ? "items-end" : "items-start"}`}>
          <span className="flex items-center gap-1">
            {hl && <PogBadge kind={hl} />}
            <span className={`text-[13.5px] truncate max-w-[80px] ${
              win ? "font-extrabold text-ink" : "font-semibold text-wgraytx"}`}>{p.name}</span>
          </span>
          {champ && <span className="text-[10px] text-wfaint truncate max-w-[88px]">{champ}</span>}
        </span>
        <span className={`relative z-10 w-9 h-9 rounded-[11px] flex items-center justify-center text-[13px] font-extrabold shrink-0 tabular-nums ${
          win ? "border-2 border-ink" : ""} ${!rated ? "bg-paper text-wmute" : ""}`}
          style={rated ? scoreChipStyle(p.avg as number) : undefined}>
          {rated ? p.avg : "–"}
        </span>
      </button>
    );
  };

  // 각 라인 대표 1명 (평점 높은 순)
  const pick = (list: Player[], lane: string) => list.filter(p => laneOf(p) === lane).sort(byAvg)[0];
  const rows = LANE_ORDER.map(lane => ({ lane, h: pick(home, lane), a: pick(away, lane) }))
    .filter(r => r.h || r.a);
  if (rows.length === 0) return null;

  return (
    <div className="mt-5 bg-card border border-wline rounded-2xl overflow-hidden">
      {/* 헤더: 양 팀 (팀 구분은 구단색 닷) */}
      <div className="flex items-center bg-ink text-paper px-3.5 py-2.5">
        <div className="flex-1 flex items-center gap-1.5 text-[13px] font-extrabold">
          <span className="w-2 h-2 rounded-full" style={{ background: teamColor(homeTeam, undefined, DEFAULT_HOME) }} />{homeTeam}
        </div>
        <span className="text-[10px] font-bold text-wfaint px-2">라인 대결</span>
        <div className="flex-1 flex items-center justify-end gap-1.5 text-[13px] font-extrabold">
          {awayTeam}<span className="w-2 h-2 rounded-full" style={{ background: teamColor(awayTeam, undefined, DEFAULT_AWAY) }} />
        </div>
      </div>

      {rows.map(({ lane, h, a }) => {
        const hv = h?.avg ?? null, av = a?.avg ?? null;
        const hWin = hv !== null && av !== null && hv > av;
        const aWin = hv !== null && av !== null && av > hv;
        const bothEmpty = hv === null && av === null;
        return (
          <div key={lane} className={`flex items-stretch border-t border-wsoft min-h-[52px] ${bothEmpty ? "opacity-50" : ""}`}>
            <Cell p={h} side="home" win={hWin} />
            <div className="w-12 shrink-0 flex flex-col items-center justify-center border-x border-wsoft">
              <span className="text-[9px] font-extrabold text-wfaint">{LANE_LABEL[lane] ?? lane}</span>
              <span className="leading-none mt-0.5">{hWin || aWin ? <GoldStar className="w-3 h-3" /> : <span className="text-[8px] font-extrabold text-wmute">VS</span>}</span>
            </div>
            <Cell p={a} side="away" win={aWin} />
          </div>
        );
      })}

      {/* 캡처용 푸터 */}
      <div className="flex items-center justify-center gap-2 bg-ink text-paper text-[12px] font-semibold py-2.5">
        <span>fanarena<span className="text-wfaint">.kr</span></span>
      </div>
    </div>
  );
}
