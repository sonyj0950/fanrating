"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { GoldStar, SPORT_LABEL, teamLabel } from "../MatchCard";
import { badgeLabel, badgeTextColor, teamColor } from "@/lib/teamColors";
import type { RankingRow } from "@/lib/rankings";

const TABS = ["epl", "kleague", "kbo", "lck"] as const;
const MIN_OPTIONS = [
  { value: 1, label: "전체" },
  { value: 5, label: "평가 5회 이상" },
  { value: 20, label: "평가 20회 이상" },
];
const PAGE_SIZE = 30;

// 팀 배지 (배지2: 솔리드 서클 — 구단색 채움 + 자동 대비 글자색, 3글자↑는 폰트 축소)
function TeamBadge({ team, colors, size = 26 }: { team: string; colors: Record<string, string>; size?: number }) {
  const bg = teamColor(team, colors, "#7d7663");
  const label = badgeLabel(team);
  return (
    <span className="rounded-full grid place-items-center font-black leading-none whitespace-nowrap select-none shrink-0"
      aria-hidden="true"
      style={{ width: size, height: size, background: bg, color: badgeTextColor(bg),
        fontSize: Math.round(size * (label.length >= 3 ? 0.3 : 0.4)), letterSpacing: "-0.02em" }}>
      {label}
    </span>
  );
}

// 최근 폼: 시즌 평균 대비 최근 5경기 평균 (±0.05 이내는 보합)
function RecentForm({ row }: { row: RankingRow }) {
  if (row.games < 3) return <span className="text-wfaint">-</span>;
  const diff = row.recentAvg - row.avg;
  if (diff > 0.05) return <span className="text-golddim font-bold">▲ {row.recentAvg.toFixed(2)}</span>;
  if (diff < -0.05) return <span className="text-live font-bold">▼ {row.recentAvg.toFixed(2)}</span>;
  return <span className="text-wsub font-semibold">— {row.recentAvg.toFixed(2)}</span>;
}

function TopCard({ row, rank, sport, colors }: { row: RankingRow; rank: number; sport: string; colors: Record<string, string> }) {
  return (
    <Link href={`/player/${row.playerId}`}
      className={`block rounded-2xl border bg-card p-3 sm:p-4 text-center shadow-[0_1px_2px_rgba(60,50,20,.05)] transition hover:-translate-y-0.5 hover:shadow-md ${
      rank === 1 ? "border-goldline" : "border-wline"}`}>
      <div className={`text-[11px] font-extrabold mb-2 ${rank === 1 ? "text-golddim" : "text-wsub"}`}>{rank}위</div>
      <div className="flex justify-center mb-2"><TeamBadge team={row.team} colors={colors} size={38} /></div>
      <div className="font-extrabold text-ink text-[14px] sm:text-[15px] truncate">{row.name}</div>
      <div className="text-[11px] text-wsub mb-2 truncate">
        {teamLabel(sport, row.team)}{row.position ? ` · ${row.position}` : ""}
      </div>
      <div className="flex items-center justify-center gap-1.5 text-2xl font-black tabular-nums text-ink">
        <GoldStar className="w-4 h-4" />{row.avg.toFixed(2)}
      </div>
      <div className="text-[11px] text-wfaint mt-1 tabular-nums">{row.games}경기 · 평가 {row.ratingCount.toLocaleString()}회</div>
    </Link>
  );
}

export default function RankingsClient({ bySport, seasons, teamColors }:
  { bySport: Record<string, RankingRow[]>; seasons: Record<string, string>; teamColors: Record<string, string> }) {
  const [sport, setSport] = useState<string>(() => TABS.find(s => (bySport[s] ?? []).length > 0) ?? "epl");
  const [team, setTeam] = useState("all");
  const [position, setPosition] = useState("all");
  const [minRatings, setMinRatings] = useState(5);
  const [sort, setSort] = useState<"avg" | "count">("avg");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const all = bySport[sport] ?? [];
  const teams = useMemo(() => Array.from(new Set(all.map(r => r.team))).sort((a, b) => a.localeCompare(b, "ko")), [all]);
  const positions = useMemo(() => Array.from(new Set(all.map(r => r.position).filter(Boolean))) as string[], [all]);

  const rows = useMemo(() => {
    const filtered = all.filter(r =>
      r.ratingCount >= minRatings &&
      (team === "all" || r.team === team) &&
      (position === "all" || r.position === position));
    if (sort === "count") return [...filtered].sort((a, b) => b.ratingCount - a.ratingCount || b.avg - a.avg);
    return filtered; // 서버에서 평균순 정렬됨
  }, [all, team, position, minRatings, sort]);

  const switchTab = (s: string) => {
    setSport(s); setTeam("all"); setPosition("all"); setLimit(PAGE_SIZE);
  };
  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3, 3 + limit);

  const selectCls = "text-xs font-semibold text-wsub bg-card border border-wline rounded-full pl-3 pr-7 py-1.5 appearance-none bg-no-repeat focus:outline-none focus:border-gold";
  const selectArrow = {
    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.5l3 3 3-3' fill='none' stroke='%238d8672' stroke-width='1.5'/%3E%3C/svg%3E\")",
    backgroundPosition: "right 8px center", backgroundSize: "12px",
  } as const;

  return (
    <div>
      <h1 className="flex items-baseline gap-2 text-lg font-extrabold text-ink px-1">
        선수 랭킹
        <span className="text-xs text-wsub font-semibold">{seasons[sport]}</span>
      </h1>
      <p className="text-xs text-wfaint px-1 mb-4">팬 평점 평균 기준 · 시즌 누적</p>

      {/* 종목 탭 — 골드 언더라인 */}
      <div className="flex gap-6 mb-4 sticky top-14 z-10 bg-paper/90 backdrop-blur border-b border-wline px-1">
        {TABS.map(s => (
          <button key={s} onClick={() => switchTab(s)}
            className={`pt-1 pb-2.5 text-sm font-bold border-b-[2.5px] -mb-px transition ${
              sport === s ? "text-ink border-gold" : "text-wfaint border-transparent hover:text-wsub"}`}>
            {SPORT_LABEL[s] ?? s}
          </button>
        ))}
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-2 mb-4 px-1">
        <select value={team} onChange={e => { setTeam(e.target.value); setLimit(PAGE_SIZE); }}
          className={selectCls} style={selectArrow} aria-label="팀 필터">
          <option value="all">팀 · 전체</option>
          {teams.map(t => <option key={t} value={t}>{teamLabel(sport, t)}</option>)}
        </select>
        {positions.length > 0 && (
          <select value={position} onChange={e => { setPosition(e.target.value); setLimit(PAGE_SIZE); }}
            className={selectCls} style={selectArrow} aria-label="포지션 필터">
            <option value="all">포지션 · 전체</option>
            {positions.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
        <select value={minRatings} onChange={e => { setMinRatings(Number(e.target.value)); setLimit(PAGE_SIZE); }}
          className={selectCls} style={selectArrow} aria-label="최소 평가 수">
          {MIN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={sort} onChange={e => setSort(e.target.value as "avg" | "count")}
          className={selectCls} style={selectArrow} aria-label="정렬">
          <option value="avg">평균 높은순</option>
          <option value="count">평가 많은순</option>
        </select>
        <span className="ml-auto text-xs text-wfaint font-semibold shrink-0">총 {rows.length}명</span>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-wfaint bg-card border border-dashed border-wline rounded-xl p-6 text-center">
          조건에 맞는 선수가 없습니다.{minRatings > 1 ? " 최소 평가 수를 낮춰 보세요." : ""}
        </p>
      ) : (
        <>
          {/* TOP 3 */}
          {sort === "avg" && team === "all" && position === "all" && top3.length === 3 && (
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
              {top3.map((r, i) => <TopCard key={r.playerId} row={r} rank={i + 1} sport={sport} colors={teamColors} />)}
            </div>
          )}

          {/* 리스트 */}
          <div className="rounded-2xl border border-wline bg-card overflow-hidden shadow-[0_1px_2px_rgba(60,50,20,.05)]">
            <div className="flex items-center gap-2.5 px-3.5 py-2 text-[11px] text-wfaint font-semibold border-b border-wsoft">
              <span className="w-7 text-center">순위</span>
              <span className="flex-1">선수</span>
              <span className="w-16 text-right hidden sm:block">최근 5경기</span>
              <span className="w-12 text-right">평균</span>
            </div>
            {(sort === "avg" && team === "all" && position === "all" && top3.length === 3 ? rest : rows.slice(0, limit + 3)).map(r => {
              const rank = rows.indexOf(r) + 1;
              return (
                <Link key={r.playerId} href={`/player/${r.playerId}`}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 border-t border-dashed border-wsoft first:border-t-0 text-[13px] hover:bg-paper/60 transition">
                  <span className={`w-7 text-center font-extrabold tabular-nums ${rank <= 3 ? "text-golddim" : "text-wsub"}`}>{rank}</span>
                  <TeamBadge team={r.team} colors={teamColors} />
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold text-ink truncate">{r.name}</span>
                    <span className="block text-[11px] text-wsub truncate tabular-nums">
                      {teamLabel(sport, r.team)}{r.position ? ` · ${r.position}` : ""} · {r.games}경기 · 평가 {r.ratingCount.toLocaleString()}
                    </span>
                  </span>
                  <span className="w-16 text-right text-[11px] tabular-nums hidden sm:block"><RecentForm row={r} /></span>
                  <span className="w-12 text-right font-black text-[15px] tabular-nums text-ink">{r.avg.toFixed(2)}</span>
                </Link>
              );
            })}
          </div>

          {rows.length > limit + 3 && (
            <div className="text-center mt-4">
              <button onClick={() => setLimit(l => l + PAGE_SIZE)}
                className="text-[13px] font-semibold text-wsub bg-card border border-wline rounded-full px-5 py-2 hover:border-ink hover:text-ink transition">
                더 보기
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
