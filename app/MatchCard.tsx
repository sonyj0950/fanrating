import Link from "next/link";
import DeleteMatchButton from "@/components/DeleteMatchButton";

export const SPORT_LABEL: Record<string, string> = {
  kbo: "⚾ 야구", kleague: "⚽ 축구", lck: "🎮 LCK", epl: "⚽ EPL",
};

export function StatusBadge({ status }: { status: string }) {
  if (status === "live")
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-500">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />LIVE</span>;
  if (status === "finished")
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">종료</span>;
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">예정</span>;
}

export function MatchCard({ m }: { m: any }) {
  const homeWin = m.homeScore != null && m.awayScore != null && m.homeScore > m.awayScore;
  const awayWin = m.homeScore != null && m.awayScore != null && m.awayScore > m.homeScore;
  return (
    <div className="group relative rounded-2xl border border-gray-300 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <Link href={`/${m.sport}/${m.id}`} className="block">
        <div className="flex items-center gap-2 text-[11px] text-gray-400 mb-3">
          <span className="text-gray-700 font-semibold">{SPORT_LABEL[m.sport] ?? m.sport}</span>
          <StatusBadge status={m.status} />
          <span className="ml-auto">
            {new Date(m.date).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        <div className="flex items-center justify-center gap-4 my-1">
          <div className="flex-1 text-right font-bold text-gray-900 text-[15px] truncate">{m.homeTeam}</div>
          <div className="flex items-center gap-2.5 font-black text-2xl tracking-wide shrink-0">
            <span className={homeWin ? "text-gray-900" : "text-gray-300"}>{m.homeScore ?? "-"}</span>
            <span className="text-gray-300 text-base">:</span>
            <span className={awayWin ? "text-gray-900" : "text-gray-300"}>{m.awayScore ?? "-"}</span>
          </div>
          <div className="flex-1 text-left font-bold text-gray-900 text-[15px] truncate">{m.awayTeam}</div>
        </div>

        {m.pog && (
          <div className="flex items-center justify-center gap-2 mt-3 pt-3 border-t border-gray-100 text-[12px]">
            <span className="text-amber-500 font-bold">🏆 {m.sport === "kbo" ? "MVP" : "MOM"}</span>
            <span className="text-gray-900 font-semibold">{m.pog.name}</span>
            <span className="text-amber-500">⭐ {m.pog.avg}</span>
            {m.ratingCount ? <span className="text-gray-400">· 평점 {m.ratingCount}</span> : null}
          </div>
        )}
      </Link>
      <div className="absolute top-3 right-3"><DeleteMatchButton matchId={m.id} /></div>
    </div>
  );
}

export function Section({ title, matches, empty }: { title: string; matches: any[]; empty: string }) {
  return (
    <section className="mb-7">
      <h2 className="flex items-center gap-2 text-[15px] font-extrabold text-gray-900 mb-3 px-1">
        <span className="w-[3px] h-[15px] rounded-sm bg-gray-900" />
        {title}
        {matches.length > 0 && <span className="ml-auto text-xs text-gray-400 font-semibold">{matches.length}경기</span>}
      </h2>
      {matches.length === 0
        ? <p className="text-sm text-gray-400 bg-white border border-dashed border-gray-200 rounded-xl p-4 text-center">{empty}</p>
        : <div className="space-y-2.5">{matches.map(m => <MatchCard key={m.id} m={m} />)}</div>}
    </section>
  );
}
