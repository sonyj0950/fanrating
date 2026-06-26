import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { KBO_TEAM_LABELS } from "@/lib/kboTeams";
import AdminForm from "./AdminForm";
import RosterPanel from "./RosterPanel";
import TeamColorPanel from "./TeamColorPanel";
import StandingsPanel from "./StandingsPanel";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") redirect("/");

  const kboMatches = await prisma.match.findMany({
    where: { sport: "kbo" }, orderBy: { date: "desc" }, take: 12,
    select: { id: true, homeTeam: true, awayTeam: true, date: true, homeScore: true, awayScore: true, _count: { select: { players: true } } },
  });
  const lckMatches = await prisma.match.findMany({
    where: { sport: "lck" }, orderBy: { date: "desc" }, take: 12,
    select: { id: true, homeTeam: true, awayTeam: true, date: true, homeScore: true, awayScore: true, _count: { select: { players: true } } },
  });

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">⚙️ 경기 등록</h1>
      <RosterPanel />
      <StandingsPanel />
      <TeamColorPanel />

      <div className="bg-white rounded p-4 shadow mb-6">
        <h2 className="font-bold mb-1">⚾ KBO 경기 라인업 편집</h2>
        <p className="text-xs text-gray-500 mb-3">아래에서 경기를 만든 뒤, 라인업·교체를 편집합니다. (경기 생성은 맨 아래 직접 등록 폼)</p>
        {kboMatches.length === 0 && <p className="text-sm text-gray-400">등록된 KBO 경기가 없습니다.</p>}
        <div className="space-y-1.5">
          {kboMatches.map(m => {
            const d = new Date(m.date).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "short", day: "numeric" });
            return (
              <a key={m.id} href={`/admin/kbo/${m.id}`}
                className="flex items-center gap-2 border rounded px-3 py-2 text-sm hover:bg-gray-50">
                <span className="text-xs text-gray-400 shrink-0 w-12">{d}</span>
                <span className="flex-1 min-w-0 truncate">
                  {KBO_TEAM_LABELS[m.awayTeam] || m.awayTeam} {m.awayScore ?? "-"} : {m.homeScore ?? "-"} {KBO_TEAM_LABELS[m.homeTeam] || m.homeTeam}
                </span>
                <span className="text-[11px] text-gray-400 shrink-0">{m._count.players ? `선수 ${m._count.players}` : "라인업 없음"}</span>
                <span className="text-xs text-blue-600 shrink-0">편집 →</span>
              </a>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded p-4 shadow mb-6">
        <h2 className="font-bold mb-1">🎮 LCK 경기 라인업 편집 <span className="text-xs font-normal text-gray-500">(수동 · API 미사용)</span></h2>
        <p className="text-xs text-gray-500 mb-3">경기를 만든 뒤(맨 아래 직접 등록), 라인업·세트·챔피언을 직접 입력합니다.</p>
        {lckMatches.length === 0 && <p className="text-sm text-gray-400">등록된 LCK 경기가 없습니다.</p>}
        <div className="space-y-1.5">
          {lckMatches.map(m => {
            const d = new Date(m.date).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "short", day: "numeric" });
            return (
              <a key={m.id} href={`/admin/lck/${m.id}`}
                className="flex items-center gap-2 border rounded px-3 py-2 text-sm hover:bg-gray-50">
                <span className="text-xs text-gray-400 shrink-0 w-12">{d}</span>
                <span className="flex-1 min-w-0 truncate">{m.awayTeam} {m.awayScore ?? "-"} : {m.homeScore ?? "-"} {m.homeTeam}</span>
                <span className="text-[11px] text-gray-400 shrink-0">{m._count.players ? `선수 ${m._count.players}` : "라인업 없음"}</span>
                <span className="text-xs text-blue-600 shrink-0">편집 →</span>
              </a>
            );
          })}
        </div>
      </div>

      <h2 className="text-sm font-bold text-gray-500 mb-2">✍️ 직접 등록 (모든 종목)</h2>
      <AdminForm />
      <p className="text-xs text-gray-500 mt-3">
        ※ 경기 삭제는 홈 화면 또는 각 경기 페이지의 🗑 버튼으로 할 수 있습니다.
        골·어시스트 기록은 경기 페이지에서 입력합니다.
      </p>
    </div>
  );
}
