"use client";
import { useState } from "react";
import { Section } from "./MatchCard";
import StandingsTable from "./StandingsTable";
import { TAB_LEAGUE } from "@/lib/standings";

const TABS = [
  { key: "soccer", label: "축구", sports: ["kleague", "epl"] },
  { key: "baseball", label: "야구", sports: ["kbo"] },
  { key: "lol", label: "LoL", sports: ["lck"] },
] as const;

export default function SportTabs({ upcoming, past, standings = {}, standingsAsOf = {}, teamColors = {} }:
  { upcoming: any[]; past: any[];
    standings?: Record<string, any[]>; standingsAsOf?: Record<string, string>; teamColors?: Record<string, string> }) {
  const [tab, setTab] = useState<string>("soccer");
  const cur = TABS.find(t => t.key === tab) ?? TABS[0];
  const inTab = (m: any) => (cur.sports as readonly string[]).includes(m.sport);
  const up = upcoming.filter(inTab);
  const ps = past.filter(inTab);
  const league = TAB_LEAGUE[tab];

  return (
    <div>
      <div className="flex gap-6 mb-5 sticky top-14 z-10 bg-paper/90 backdrop-blur border-b border-wline px-1">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`pt-1 pb-2.5 text-sm font-bold border-b-[2.5px] -mb-px transition ${
              tab === t.key ? "text-ink border-gold" : "text-wfaint border-transparent hover:text-wsub"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {league && standings[league]?.length > 0 && (
        <StandingsTable league={league} rows={standings[league]}
          asOf={standingsAsOf[league]} teamColors={teamColors} />
      )}

      {up.length > 0 && <Section title="예정된 경기" matches={up} empty="" />}
      <Section title="이전의 경기" matches={ps} empty={`${cur.label} 경기가 아직 없습니다.`} />
    </div>
  );
}
