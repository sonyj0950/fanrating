"use client";
import { useState } from "react";
import Link from "next/link";
import ShareButton from "@/components/ShareButton";
import { GoldStar, teamLabel } from "../MatchCard";
import { badgeLabel, badgeTextColor, teamColor } from "@/lib/teamColors";
import { scoreTextColor } from "@/lib/scoreColor";
import type { BestPick, WeeklyBest, WeeklyRow } from "@/lib/weeklyBest";

const TABS = [
  { key: "soccer", label: "축구", title: "베스트 XI" },
  { key: "kbo", label: "KBO", title: "베스트 나인" },
  { key: "lck", label: "LoL", title: "베스트 5" },
] as const;

function Badge({ team, colors, size = 34 }: { team: string; colors: Record<string, string>; size?: number }) {
  const bg = teamColor(team, colors, "#7d7663");
  const label = badgeLabel(team);
  return (
    <span className="rounded-full grid place-items-center font-black leading-none whitespace-nowrap select-none shrink-0"
      aria-hidden="true"
      style={{ width: size, height: size, background: bg, color: badgeTextColor(bg),
        fontSize: Math.round(size * (label.length >= 3 ? 0.28 : 0.38)), letterSpacing: "-0.02em" }}>
      {label}
    </span>
  );
}

// ⚽ 포메이션 칩 — 공격/미드/수비/GK 줄 중앙 정렬
function FormationChip({ p, colors }: { p: BestPick; colors: Record<string, string> }) {
  return (
    <Link href={`/player/${p.playerId}`} className="flex flex-col items-center gap-1 w-[76px] sm:w-[88px] group">
      <Badge team={p.team} colors={colors} />
      <span className="text-[12px] font-bold text-ink truncate max-w-full group-hover:underline">{p.name}</span>
      <span className="flex items-center gap-0.5 text-[12px] font-black tabular-nums" style={{ color: scoreTextColor(p.avg) }}>
        <GoldStar className="w-2.5 h-2.5" />{p.avg.toFixed(2)}
      </span>
    </Link>
  );
}

function EmptyChip() {
  return (
    <span className="flex flex-col items-center gap-1 w-[76px] sm:w-[88px] opacity-60">
      <span className="w-[34px] h-[34px] rounded-full border border-dashed border-wline grid place-items-center text-wfaint text-sm">?</span>
      <span className="text-[11px] text-wfaint">적임자 없음</span>
    </span>
  );
}

// 리스트형 행 (KBO·LoL)
function PickRow({ p, slot, sport, colors }: { p: BestPick | null; slot: string; sport: string; colors: Record<string, string> }) {
  return (
    <div className="flex items-center gap-2.5 px-3.5 py-2.5 border-t border-dashed border-wsoft first:border-t-0 text-[13px]">
      <span className="w-16 shrink-0 text-[11px] font-extrabold text-wgraytx bg-wgray rounded-full px-2 py-0.5 text-center">{slot}</span>
      {p ? (
        <>
          <Badge team={p.team} colors={colors} size={26} />
          <Link href={`/player/${p.playerId}`} className="flex-1 min-w-0 hover:underline">
            <span className="block font-bold text-ink truncate">{p.name}</span>
            <span className="block text-[11px] text-wsub truncate">{teamLabel(sport, p.team)} · 평가 {p.count}회</span>
          </Link>
          <span className="flex items-center gap-1 font-black text-[15px] tabular-nums shrink-0" style={{ color: scoreTextColor(p.avg) }}>
            <GoldStar className="w-3 h-3" />{p.avg.toFixed(2)}
          </span>
        </>
      ) : (
        <span className="flex-1 text-[12px] text-wfaint">적임자 없음 — 이번 주 평가 3회 이상 선수 없음</span>
      )}
    </div>
  );
}

export default function WeeklyClient({ best, teamColors }: { best: WeeklyBest; teamColors: Record<string, string> }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("soccer");
  const cur = TABS.find(t => t.key === tab)!;

  const soccerEmpty = best.soccer.every(r => r.picks.every(p => !p));
  const listRows = (rows: WeeklyRow[], sport: string) => {
    const picks = rows[0].picks;
    const slots = sport === "kbo"
      ? ["선발투수", "포수", "1루수", "2루수", "3루수", "유격수", "좌익수", "중견수", "우익수", "지명타자"]
      : ["탑", "정글", "미드", "원딜", "서폿"];
    const allEmpty = picks.every(p => !p);
    if (allEmpty)
      return <p className="text-sm text-wfaint bg-card border border-dashed border-wline rounded-xl p-6 text-center">
        이번 주 평가된 경기가 없습니다.</p>;
    return (
      <div className="rounded-2xl border border-wline bg-card overflow-hidden shadow-[0_1px_2px_rgba(60,50,20,.05)]">
        {picks.map((p, i) => <PickRow key={i} p={p} slot={slots[i]} sport={sport} colors={teamColors} />)}
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-baseline gap-2 px-1 flex-wrap">
        <h1 className="text-lg font-extrabold text-ink">주간 베스트</h1>
        <span className="text-xs text-wsub font-semibold">{cur.title}</span>
        <span className="ml-auto flex items-center gap-1.5 text-xs font-semibold">
          {best.hasPrev ? (
            <Link href={`/weekly?w=${best.offset - 1}`} className="px-2 py-1 rounded-full border border-wline text-wsub hover:border-ink hover:text-ink transition">←</Link>
          ) : <span className="px-2 py-1 text-wmute">←</span>}
          <span className="text-wsub tabular-nums">{best.weekLabel}</span>
          {best.hasNext ? (
            <Link href={`/weekly?w=${best.offset + 1}`} className="px-2 py-1 rounded-full border border-wline text-wsub hover:border-ink hover:text-ink transition">→</Link>
          ) : <span className="px-2 py-1 text-wmute">→</span>}
        </span>
      </div>
      <p className="text-xs text-wfaint px-1 mb-4">
        {best.offset === 0 ? "이번 주" : `${-best.offset}주 전`} 팬 평점 기준 · 평가 3회 이상 선수만 선정
      </p>

      <div className="flex gap-6 mb-4 sticky top-14 z-10 bg-paper/90 backdrop-blur border-b border-wline px-1">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`pt-1 pb-2.5 text-sm font-bold border-b-[2.5px] -mb-px transition ${
              tab === t.key ? "text-ink border-gold" : "text-wfaint border-transparent hover:text-wsub"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "soccer" && (
        soccerEmpty ? (
          <p className="text-sm text-wfaint bg-card border border-dashed border-wline rounded-xl p-6 text-center">
            이번 주 평가된 경기가 없습니다.</p>
        ) : (
          <div className="rounded-2xl border border-wline bg-card shadow-[0_1px_2px_rgba(60,50,20,.05)] px-2 py-4">
            {best.soccer.map((row, ri) => (
              <div key={row.label} className={`py-3 ${ri > 0 ? "border-t border-dashed border-wsoft" : ""}`}>
                <div className="text-center text-[10px] font-extrabold text-wfaint tracking-widest mb-2">{row.label}</div>
                <div className="flex justify-center gap-1 sm:gap-3 flex-wrap">
                  {row.picks.map((p, i) => p
                    ? <FormationChip key={p.playerId} p={p} colors={teamColors} />
                    : <EmptyChip key={`e${i}`} />)}
                </div>
              </div>
            ))}
          </div>
        )
      )}
      {tab === "kbo" && listRows(best.kbo, "kbo")}
      {tab === "lck" && listRows(best.lck, "lck")}

      <div className="flex justify-center mt-4">
        <ShareButton title={`fanarena 주간 베스트 (${best.weekLabel})`}
          text={`팬 평점으로 뽑은 이주의 ${cur.title}`}
          path={`/weekly?w=${best.offset}`}
          className="text-[13px] font-semibold text-wsub bg-card border border-wline rounded-full px-5 py-2 hover:border-ink hover:text-ink transition" />
      </div>
    </div>
  );
}
