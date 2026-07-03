"use client";
import { LEAGUE_COLUMNS, winRate, type StandingRow } from "@/lib/standings";
import { teamColor } from "@/lib/teamColors";
import { KBO_TEAM_LABELS } from "@/lib/kboTeams";

function cellValue(r: StandingRow, key: string): string {
  if (key === "rate") return winRate(r);
  const v = (r as any)[key];
  return v == null || v === "" ? "-" : String(v);
}

export default function StandingsTable({ league, rows, asOf, teamColors = {} }:
  { league: string; rows: StandingRow[]; asOf?: string; teamColors?: Record<string, string> }) {
  if (!rows || rows.length === 0) return null;
  const cols = LEAGUE_COLUMNS[league] ?? LEAGUE_COLUMNS.epl;
  const title = league === "epl" ? "EPL 순위" : league === "kbo" ? "KBO 순위"
    : league === "lck" ? "LCK 순위" : "순위";
  const asOfLabel = asOf
    ? new Date(asOf).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" }) + " 기준"
    : "";

  return (
    <div className="mb-5 border border-wline rounded-xl overflow-hidden bg-card shadow-[0_1px_2px_rgba(60,50,20,.05)]">
      <div className="flex items-baseline justify-between px-3.5 py-2 border-b border-wsoft">
        <span className="text-sm font-extrabold text-ink">{title}</span>
        {asOfLabel && <span className="text-[11px] text-wsub font-medium">{asOfLabel}</span>}
      </div>
      <table className="w-full text-[13px] tabular-nums">
        <thead>
          <tr className="text-wfaint text-[11px]">
            <th className="text-center font-semibold py-1.5 w-8">순위</th>
            <th className="text-left font-semibold py-1.5">팀</th>
            {cols.map(c => <th key={c.key} className="text-center font-semibold py-1.5 px-1">{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const label = league === "kbo" ? (KBO_TEAM_LABELS[r.team] ?? r.team) : r.team;
            const color = teamColor(r.team, teamColors, "#cdc7b6");
            return (
              <tr key={r.rank} className="border-t border-wsoft">
                <td className="text-center font-extrabold py-1.5 text-wsub">{r.rank}</td>
                <td className="py-1.5 truncate font-semibold text-ink">
                  <span className="inline-block w-[3px] h-3.5 rounded-sm mr-2 align-middle" style={{ background: color }} />
                  {label}
                </td>
                {cols.map(c => (
                  <td key={c.key} className="text-center px-1 text-wsub">{cellValue(r, c.key)}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
