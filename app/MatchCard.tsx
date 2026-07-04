import Link from "next/link";
import DeleteMatchButton from "@/components/DeleteMatchButton";
import { KBO_TEAM_LABELS } from "@/lib/kboTeams";
import { sportPath } from "@/lib/sportUrl";

// kleague·lck는 A매치·MSI 등 해당 리그가 아닌 경기도 담는 버킷이라 리그명이 아닌 종목명으로 표기
export const SPORT_LABEL: Record<string, string> = {
  kbo: "KBO", kleague: "축구", lck: "LoL", epl: "EPL",
};

// 종목별 최고 평점 선수 라벨
export function pogLabel(sport: string) {
  return sport === "kbo" ? "MVP" : sport === "lck" ? "POG" : "MOM";
}

// 골드 별 (이모지 ⭐ 대체)
export function GoldStar({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={`${className} fill-gold shrink-0`} aria-hidden="true">
      <path d="M10 1l2.4 5.9 6.4.5-4.9 4.2 1.5 6.2L10 14.5 4.6 17.8l1.5-6.2L1.2 7.4l6.4-.5z" />
    </svg>
  );
}

// 표시용 팀명: KBO는 약칭(저장값) → 풀네임. 그 외 종목은 저장값 그대로.
export function teamLabel(sport: string, team: string) {
  return sport === "kbo" ? (KBO_TEAM_LABELS[team] ?? team) : team;
}

export function StatusBadge({ status }: { status: string }) {
  if (status === "live")
    return <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-live">
      <span className="w-1.5 h-1.5 rounded-full bg-live animate-pulse" />LIVE</span>;
  if (status === "finished")
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-wgray text-wgraytx">종료</span>;
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-goldbg text-golddim">예정</span>;
}

export function MatchCard({ m }: { m: any }) {
  const homeWin = m.homeScore != null && m.awayScore != null && m.homeScore > m.awayScore;
  const awayWin = m.homeScore != null && m.awayScore != null && m.awayScore > m.homeScore;
  return (
    <div className="group relative rounded-2xl border border-wline bg-card p-4 shadow-[0_1px_2px_rgba(60,50,20,.05)] transition hover:-translate-y-0.5 hover:shadow-md">
      <Link href={`/${sportPath(m.sport)}/${m.id}`} className="block">
        <div className="flex items-center gap-2 text-[11px] text-wfaint mb-3">
          <span className="text-wsub font-bold">{SPORT_LABEL[m.sport] ?? m.sport}</span>
          <StatusBadge status={m.status} />
          {m.round && <span className="text-wsub font-medium truncate">{m.round}</span>}
          <span className="ml-auto shrink-0">
            {new Date(m.date).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </span>
          {/* 관리자 전용 — 비관리자에겐 렌더되지 않음. 날짜와 겹치지 않게 인라인 배치 */}
          <DeleteMatchButton matchId={m.id} />
        </div>

        <div className="flex items-center justify-center gap-4 my-1">
          <div className={`flex-1 text-right font-bold text-[15px] truncate ${awayWin ? "text-wfaint" : "text-ink"}`}>{teamLabel(m.sport, m.homeTeam)}</div>
          <div className="flex items-center gap-2.5 font-black text-2xl tracking-wide shrink-0 tabular-nums">
            <span className={awayWin ? "text-wmute" : "text-ink"}>{m.homeScore ?? "-"}</span>
            <span className="text-wmute text-base">:</span>
            <span className={homeWin ? "text-wmute" : "text-ink"}>{m.awayScore ?? "-"}</span>
          </div>
          <div className={`flex-1 text-left font-bold text-[15px] truncate ${homeWin ? "text-wfaint" : "text-ink"}`}>{teamLabel(m.sport, m.awayTeam)}</div>
        </div>

        {m.pog && (
          <div className="flex items-center justify-center gap-2 mt-3 pt-3 border-t border-dashed border-wline text-[12px]">
            <GoldStar className="w-3.5 h-3.5" />
            <span className="text-golddim font-extrabold">{pogLabel(m.sport)}</span>
            <span className="text-ink font-bold">{m.pog.name}</span>
            <span className="text-wsub font-semibold tabular-nums">{m.pog.avg}</span>
            {m.ratingCount ? <span className="text-wfaint">· 평점 {m.ratingCount}</span> : null}
          </div>
        )}
      </Link>
    </div>
  );
}

export function Section({ title, matches, empty }: { title: string; matches: any[]; empty: string }) {
  return (
    <section className="mb-7">
      <h2 className="flex items-baseline gap-2 text-[15px] font-extrabold text-ink mb-3 px-1">
        {title}
        {matches.length > 0 && <span className="ml-auto text-xs text-wfaint font-semibold">{matches.length}경기</span>}
      </h2>
      {matches.length === 0
        ? <p className="text-sm text-wfaint bg-card border border-dashed border-wline rounded-xl p-4 text-center">{empty}</p>
        : <div className="space-y-2.5">{matches.map(m => <MatchCard key={m.id} m={m} />)}</div>}
    </section>
  );
}
