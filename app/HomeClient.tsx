"use client";
// 홈 개편 (개선 A안 "라이브 불판"):
//  - 상단: 라이브 경기 히어로 스트립 (라이브 있을 때만) — 메인 1 + 미니 2
//  - 본문: 전체 탭 = 고밀도 한 줄 리스트(불판), 종목 탭 = C안 2열 카드 그리드 + 순위표
//  - 우측: 사이드바 (이번 주 평점 TOP5 · 순위표 요약 · 주간 베스트 경기)
import { useState } from "react";
import Link from "next/link";
import Wide from "@/components/Wide";
import StandingsTable from "./StandingsTable";
import { SPORT_LABEL, StatusBadge, pogLabel, teamLabel } from "./MatchCard";
import { TAB_LEAGUE } from "@/lib/standings";
import { KBO_TEAM_LABELS } from "@/lib/kboTeams";
import { sportPath } from "@/lib/sportUrl";
import { scoreTextColor } from "@/lib/scoreColor";
import { teamColor, DEFAULT_HOME, DEFAULT_AWAY } from "@/lib/teamColors";

type Slim = {
  id: string; sport: string; date: string;
  homeTeam: string; awayTeam: string; homeScore: number | null; awayScore: number | null;
  status: string; round: string | null;
  pog: { name: string; avg: number } | null; ratingCount: number;
  split?: { home: number; away: number } | null;
};

const TABS = [
  { key: "all", label: "전체", sports: null as string[] | null },
  { key: "baseball", label: "야구", sports: ["kbo"] },
  { key: "soccer", label: "축구", sports: ["kleague", "epl"] },
  { key: "lol", label: "LoL", sports: ["lck"] },
] as const;

const HOT_MIN = 30; // "화제" 배지 기준 (공유카드와 동일한 평점 30개)

// 종목 미니 배지 (리스트 행·카드 공용) — 색은 globals.css의 .spb-* (테마별)
const SPORT_BADGE: Record<string, string> = {
  kbo: "spb-kbo",
  kleague: "spb-soccer",
  epl: "spb-soccer",
  lck: "spb-lck",
};
function SportBadge({ sport }: { sport: string }) {
  return (
    <span className={`inline-grid place-items-center min-w-[34px] h-[18px] px-1.5 rounded text-[10px] font-black tracking-wide shrink-0 ${SPORT_BADGE[sport] ?? "bg-wgray text-wgraytx"}`}>
      {SPORT_LABEL[sport] ?? sport}
    </span>
  );
}

const KST_OPT = { timeZone: "Asia/Seoul" } as const;
function rowTime(m: Slim): string {
  const d = new Date(m.date);
  const now = new Date();
  const sameDay = d.toLocaleDateString("ko-KR", KST_OPT) === now.toLocaleDateString("ko-KR", KST_OPT);
  if (sameDay) return d.toLocaleTimeString("ko-KR", { ...KST_OPT, hour: "2-digit", minute: "2-digit", hour12: false });
  return d.toLocaleDateString("ko-KR", { ...KST_OPT, month: "numeric", day: "numeric" });
}
function href(m: Slim) { return `/${sportPath(m.sport)}/${m.id}`; }
function tl(m: Slim, team: string) { return teamLabel(m.sport, team); }

// ── 불판 한 줄 행 (전체 탭) ──
function MatchRow({ m }: { m: Slim }) {
  const homeWin = m.homeScore != null && m.awayScore != null && m.homeScore > m.awayScore;
  const awayWin = m.homeScore != null && m.awayScore != null && m.awayScore > m.homeScore;
  const hot = m.ratingCount >= HOT_MIN;
  return (
    <Link href={href(m)}
      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg border-b border-wsoft/60 last:border-b-0 hover:bg-card transition text-[13.5px]">
      <span className="w-11 shrink-0 grid place-items-center"><StatusBadge status={m.status} /></span>
      <SportBadge sport={m.sport} />
      <span className="font-bold whitespace-nowrap tabular-nums shrink-0">
        <span className={awayWin ? "text-wmute" : "text-ink"}>{tl(m, m.homeTeam)}</span>
        {m.homeScore != null || m.awayScore != null ? (
          <span className="mx-1.5 font-black tracking-wide">
            <span className={awayWin ? "text-wmute" : "text-ink"}>{m.homeScore ?? "-"}</span>
            <span className="text-wmute mx-0.5">:</span>
            <span className={homeWin ? "text-wmute" : "text-ink"}>{m.awayScore ?? "-"}</span>
          </span>
        ) : <span className="mx-1.5 text-wmute text-[12px] font-bold">vs</span>}
        <span className={homeWin ? "text-wmute" : "text-ink"}>{tl(m, m.awayTeam)}</span>
      </span>
      {hot && <span className="text-[9.5px] font-black text-deep bg-gold rounded px-1 py-[1px] tracking-wide shrink-0">화제</span>}
      <span className="text-[12px] text-wsub truncate min-w-0">
        {m.pog ? (
          <>
            {pogLabel(m.sport)} <b className="text-ink font-bold">{m.pog.name}</b>{" "}
            <b className="font-extrabold tabular-nums" style={{ color: scoreTextColor(m.pog.avg) }}>{m.pog.avg}</b>
          </>
        ) : m.round ? m.round : null}
      </span>
      <span className="ml-auto shrink-0 font-black text-golddim text-[12.5px] tabular-nums">
        {m.ratingCount > 0 ? `[${m.ratingCount.toLocaleString()}]` : ""}
      </span>
      <span className="w-11 shrink-0 text-right text-[11px] text-wfaint font-bold tabular-nums">{rowTime(m)}</span>
    </Link>
  );
}

// ── C안 컴팩트 카드 (종목 탭 2열 그리드) ──
function CompactCard({ m }: { m: Slim }) {
  const homeWin = m.homeScore != null && m.awayScore != null && m.homeScore > m.awayScore;
  const awayWin = m.homeScore != null && m.awayScore != null && m.awayScore > m.homeScore;
  const live = m.status === "live";
  return (
    <Link href={href(m)}
      className={`block rounded-xl border p-3 transition hover:-translate-y-0.5 hover:shadow-md ${
        live ? "live-card" : "border-wline bg-card"}`}>
      <div className="flex items-center gap-2 text-[10.5px] text-wfaint font-bold mb-2">
        <SportBadge sport={m.sport} />
        <StatusBadge status={m.status} />
        {m.round && <span className="truncate">{m.round}</span>}
        <span className="ml-auto shrink-0 tabular-nums">{rowTime(m)}</span>
      </div>
      <div className="flex items-center justify-between gap-2 font-bold text-[14px]">
        <span className={`truncate ${awayWin ? "text-wmute" : "text-ink"}`}>{tl(m, m.homeTeam)}</span>
        <span className="shrink-0 font-black text-[18px] tracking-wide tabular-nums">
          <span className={awayWin ? "text-wmute" : "text-ink"}>{m.homeScore ?? "-"}</span>
          <span className="text-wmute text-[13px] mx-1">:</span>
          <span className={homeWin ? "text-wmute" : "text-ink"}>{m.awayScore ?? "-"}</span>
        </span>
        <span className={`truncate text-right ${homeWin ? "text-wmute" : "text-ink"}`}>{tl(m, m.awayTeam)}</span>
      </div>
      <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-dashed border-wsoft text-[11.5px]">
        {m.pog ? (
          <>
            <span className="text-golddim font-black">{live ? "실시간" : pogLabel(m.sport)}</span>
            <span className="text-ink font-bold truncate">{m.pog.name}</span>
            <span className="font-extrabold tabular-nums" style={{ color: scoreTextColor(m.pog.avg) }}>{m.pog.avg}</span>
          </>
        ) : (
          <span className="text-wfaint">{m.status === "scheduled" ? "경기 시작 후 평점이 열립니다" : "아직 평점이 없습니다"}</span>
        )}
        <span className="ml-auto text-wfaint tabular-nums shrink-0">
          {m.ratingCount > 0 ? `평점 ${m.ratingCount.toLocaleString()}` : ""}
        </span>
      </div>
    </Link>
  );
}

// ── 히어로 스트립 (라이브 있을 때만) ──
function HeroStrip({ main, minis, teamColors }: { main: Slim; minis: Slim[]; teamColors: Record<string, string> }) {
  const pct = main.split
    ? Math.round((main.split.home / (main.split.home + main.split.away)) * 100)
    : null;
  const hc = teamColor(main.homeTeam, teamColors, DEFAULT_HOME);
  const ac = teamColor(main.awayTeam, teamColors, DEFAULT_AWAY);
  return (
    <div className="grid md:grid-cols-[1.7fr_1fr_1fr] gap-3 mb-5">
      <Link href={href(main)}
        className="hero-card rounded-2xl border border-goldline p-4 sm:p-5 flex flex-col gap-2.5 transition hover:-translate-y-0.5 hover:shadow-lg">
        <div className="flex items-center gap-2 text-[11.5px] text-wsub font-bold">
          <StatusBadge status={main.status} />
          <SportBadge sport={main.sport} />
          {main.round && <span className="truncate">{main.round}</span>}
        </div>
        <div className="flex items-center justify-center gap-4 sm:gap-5">
          <span className="text-[16px] sm:text-[17px] font-black truncate">{tl(main, main.homeTeam)}</span>
          <span className="text-[30px] sm:text-[34px] font-black tracking-widest tabular-nums shrink-0">
            {main.homeScore ?? "-"}<span className="text-wmute text-[20px] mx-1">:</span>{main.awayScore ?? "-"}
          </span>
          <span className="text-[16px] sm:text-[17px] font-black truncate">{tl(main, main.awayTeam)}</span>
        </div>
        {pct != null && (
          <div>
            <div className="h-[6px] rounded-full overflow-hidden flex bg-well">
              <i style={{ width: `${pct}%`, background: hc }} />
              <i style={{ width: `${100 - pct}%`, background: ac }} />
            </div>
            <div className="flex justify-between text-[11px] font-extrabold text-wsub mt-1 tabular-nums">
              <span>{tl(main, main.homeTeam)} 팬 평점 우세 {pct}%</span>
              <span>{100 - pct}%</span>
            </div>
          </div>
        )}
        <div className="flex items-center gap-3 mt-auto pt-1">
          <span className="bg-gold text-deep font-black text-[12.5px] px-4 py-2 rounded-lg shrink-0">지금 평점 남기기</span>
          <span className="text-[12px] text-wsub font-bold tabular-nums">
            {main.ratingCount > 0
              ? <><b className="text-golddim">{main.ratingCount.toLocaleString()}개</b> 평점 진행 중</>
              : "가장 먼저 평점을 남겨 보세요"}
          </span>
        </div>
      </Link>
      {minis.map(m => (
        <Link key={m.id} href={href(m)}
          className="hidden md:flex rounded-2xl border border-wline bg-card p-4 flex-col justify-center gap-1.5 transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-center gap-2 text-[11px] text-wfaint font-bold">
            <StatusBadge status={m.status} /><SportBadge sport={m.sport} />
            <span className="ml-auto tabular-nums">{rowTime(m)}</span>
          </div>
          <div className="text-[14.5px] font-black tabular-nums truncate">
            {tl(m, m.homeTeam)}
            {m.homeScore != null || m.awayScore != null
              ? <span className="mx-1.5">{m.homeScore ?? "-"}<span className="text-wmute mx-0.5">:</span>{m.awayScore ?? "-"}</span>
              : <span className="text-wmute text-[12px] font-bold mx-1.5">vs</span>}
            {tl(m, m.awayTeam)}
          </div>
          <div className="text-[11px] text-wsub truncate tabular-nums">
            {m.pog
              ? <>{m.status === "live" ? "실시간 1위" : pogLabel(m.sport)} {m.pog.name} <b style={{ color: scoreTextColor(m.pog.avg) }}>{m.pog.avg}</b></>
              : m.round ?? (m.status === "scheduled" ? "예정" : "")}
            {m.ratingCount > 0 && <span className="text-wfaint"> · 평점 {m.ratingCount.toLocaleString()}</span>}
          </div>
        </Link>
      ))}
    </div>
  );
}

// ── 사이드바 박스 ──
function SideBox({ title, tag, children }: { title: string; tag?: string; children: React.ReactNode }) {
  return (
    <div className="border border-wline rounded-xl bg-card overflow-hidden">
      <div className="flex items-center px-3.5 py-2.5 border-b border-wsoft text-[13px] font-black">
        {title}{tag && <span className="ml-auto text-[10.5px] text-wfaint font-bold">{tag}</span>}
      </div>
      {children}
    </div>
  );
}

function daySection(label: string) {
  return (
    <div className="flex items-center gap-2 text-[11.5px] font-black text-wfaint tracking-wide pt-3.5 pb-1.5 px-1">
      {label}<span className="flex-1 h-px bg-wsoft" />
    </div>
  );
}

export default function HomeClient({ today, upcoming, past, standings, standingsAsOf, teamColors, weekTop5, weekBest, initialTab = "all" }: {
  today: Slim[]; upcoming: Slim[]; past: Slim[];
  standings: Record<string, any[]>; standingsAsOf: Record<string, string>; teamColors: Record<string, string>;
  weekTop5: { playerId: string; name: string; team: string; avg: number; count: number }[];
  weekBest: Slim[];
  initialTab?: string;
}) {
  const [pastLimit, setPastLimit] = useState(15);
  // 탭은 헤더 내비(라우트)가 전담 — 내부 탭 UI 없음 (중복 제거)
  const cur = TABS.find(t => t.key === initialTab) ?? TABS[0];

  // 히어로: 라이브 경기(참여 많은 순) — 메인 1 + 미니 2 (모자라면 다음 예정 경기로 채움)
  const live = [...today, ...past].filter(m => m.status === "live").sort((a, b) => b.ratingCount - a.ratingCount);
  const heroMain = live[0] ?? null;
  const heroMinis = heroMain
    ? [...live.slice(1), ...today.filter(m => m.status === "scheduled"), ...upcoming].slice(0, 2)
    : [];

  // 오늘 그룹: 라이브 → 종료 → 예정 순
  const order = (m: Slim) => (m.status === "live" ? 0 : m.status === "finished" ? 1 : 2);
  const todaySorted = [...today].sort((a, b) => order(a) - order(b));

  const inTab = (m: Slim) => !cur.sports || (cur.sports as readonly string[]).includes(m.sport);
  const league = cur.key !== "all" ? TAB_LEAGUE[cur.key] : undefined;

  return (
    <Wide>
      {heroMain && <HeroStrip main={heroMain} minis={heroMinis} teamColors={teamColors} />}

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-6 lg:items-start">
        <div className="min-w-0">
          {cur.key === "all" ? (
            /* ── 전체: 불판 리스트 ── */
            <div>
              {todaySorted.length > 0 && (
                <>
                  {daySection(`오늘 · ${new Date().toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short" })}`)}
                  {todaySorted.map(m => <MatchRow key={m.id} m={m} />)}
                </>
              )}
              {upcoming.length > 0 && (
                <>
                  {daySection("예정")}
                  {upcoming.slice(0, 8).map(m => <MatchRow key={m.id} m={m} />)}
                </>
              )}
              {past.length > 0 && (
                <>
                  {daySection("이전 경기")}
                  {past.slice(0, pastLimit).map(m => <MatchRow key={m.id} m={m} />)}
                  {past.length > pastLimit && (
                    <div className="text-center mt-3">
                      <button onClick={() => setPastLimit(l => l + 20)}
                        className="text-[13px] font-semibold text-wsub bg-card border border-wline rounded-full px-5 py-2 hover:border-ink hover:text-ink transition">
                        더 보기
                      </button>
                    </div>
                  )}
                </>
              )}
              {todaySorted.length === 0 && upcoming.length === 0 && past.length === 0 && (
                <p className="text-sm text-wfaint bg-card border border-dashed border-wline rounded-xl p-6 text-center mt-4">
                  등록된 경기가 없습니다.
                </p>
              )}
            </div>
          ) : (
            /* ── 종목: C안 카드 그리드 + 순위표 ── */
            <div className="pt-4">
              {league && standings[league]?.length > 0 && (
                <StandingsTable league={league} rows={standings[league]}
                  asOf={standingsAsOf[league]} teamColors={teamColors} />
              )}
              {(() => {
                const t = todaySorted.filter(inTab);
                const up = upcoming.filter(inTab);
                const ps = past.filter(inTab);
                return (
                  <>
                    {t.length > 0 && (
                      <section className="mb-5">
                        <h2 className="text-[14px] font-black text-ink mb-2.5 px-1">오늘의 경기</h2>
                        <div className="grid sm:grid-cols-2 gap-2.5">{t.map(m => <CompactCard key={m.id} m={m} />)}</div>
                      </section>
                    )}
                    {up.length > 0 && (
                      <section className="mb-5">
                        <h2 className="text-[14px] font-black text-ink mb-2.5 px-1">예정된 경기</h2>
                        <div className="grid sm:grid-cols-2 gap-2.5">{up.slice(0, 6).map(m => <CompactCard key={m.id} m={m} />)}</div>
                      </section>
                    )}
                    <section className="mb-5">
                      <h2 className="text-[14px] font-black text-ink mb-2.5 px-1">이전 경기</h2>
                      {ps.length === 0
                        ? <p className="text-sm text-wfaint bg-card border border-dashed border-wline rounded-xl p-4 text-center">{cur.label} 경기가 아직 없습니다.</p>
                        : <div className="grid sm:grid-cols-2 gap-2.5">{ps.slice(0, 10).map(m => <CompactCard key={m.id} m={m} />)}</div>}
                    </section>
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* ── 사이드바 ── */}
        <aside className="mt-8 lg:mt-0 lg:sticky lg:top-[72px] flex flex-col gap-3.5">
          {weekTop5.length > 0 && (
            <SideBox title="이번 주 평점 TOP 5" tag="최근 7일 · 평가 5회 이상">
              <ol>
                {weekTop5.map((p, i) => (
                  <li key={p.playerId}>
                    <Link href={`/player/${p.playerId}`}
                      className="flex items-center gap-2.5 px-3.5 py-2 text-[13px] font-bold hover:bg-paper/60 transition border-b border-wsoft/50 last:border-b-0">
                      <span className={`w-[18px] h-[18px] rounded grid place-items-center text-[10.5px] font-black shrink-0 ${
                        i < 3 ? "bg-gold text-deep" : "bg-wsoft text-wgraytx"}`}>{i + 1}</span>
                      <span className="truncate text-ink">{p.name}</span>
                      <span className="text-[10.5px] text-wfaint font-bold shrink-0">{p.team}</span>
                      <span className="ml-auto inline-grid place-items-center min-w-[38px] h-[22px] px-1.5 rounded-full text-[12.5px] font-black tabular-nums bg-well border border-wsoft shrink-0"
                        style={{ color: scoreTextColor(p.avg) }}>
                        {p.avg.toFixed(1)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </SideBox>
          )}

          {Object.keys(standings).map(lg => (
            <SideBox key={lg}
              title={lg === "kbo" ? "KBO 순위" : lg === "epl" ? "EPL 순위" : lg === "lck" ? "LCK 순위" : `${lg} 순위`}
              tag={standingsAsOf[lg] ? new Date(standingsAsOf[lg]).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric" }) + " 기준" : undefined}>
              <table className="w-full text-[12.5px] tabular-nums">
                <tbody>
                  {standings[lg].slice(0, 5).map((r: any) => (
                    <tr key={r.rank} className="border-b border-wsoft/50 last:border-b-0">
                      <td className="w-8 text-center py-1.5 font-black text-golddim">{r.rank}</td>
                      <td className="py-1.5 font-bold text-ink truncate">
                        {lg === "kbo" ? (KBO_TEAM_LABELS[r.team] ?? r.team) : r.team}
                      </td>
                      <td className="w-14 text-right pr-3.5 py-1.5 font-black text-wsub">
                        {r.points != null && r.points !== 0 ? `${r.points}점`
                          : r.win + r.loss > 0 ? (r.win / (r.win + r.loss)).toFixed(3).replace(/^0/, "") : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SideBox>
          ))}

          {weekBest.length > 0 && (
            <SideBox title="주간 베스트 경기" tag="참여수 기준">
              <ol>
                {weekBest.map((m, i) => (
                  <li key={m.id}>
                    <Link href={href(m)}
                      className="flex items-center gap-2.5 px-3.5 py-2 text-[12.5px] font-bold hover:bg-paper/60 transition border-b border-wsoft/50 last:border-b-0">
                      <span className={`w-[18px] h-[18px] rounded grid place-items-center text-[10.5px] font-black shrink-0 ${
                        i === 0 ? "bg-gold text-deep" : "bg-wsoft text-wgraytx"}`}>{i + 1}</span>
                      <span className="truncate text-ink tabular-nums">
                        {tl(m, m.homeTeam)} {m.homeScore ?? "-"}:{m.awayScore ?? "-"} {tl(m, m.awayTeam)}
                      </span>
                      <span className="ml-auto font-black text-golddim tabular-nums shrink-0">[{m.ratingCount.toLocaleString()}]</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </SideBox>
          )}

          {weekTop5.length === 0 && weekBest.length === 0 && Object.keys(standings).length === 0 && (
            <SideBox title="이번 주">
              <p className="text-[12px] text-wfaint p-3.5">아직 이번 주 데이터가 없습니다. 경기에 평점을 남기면 여기에 랭킹이 쌓입니다.</p>
            </SideBox>
          )}
        </aside>
      </div>
    </Wide>
  );
}
