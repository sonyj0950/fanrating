import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "관리자 조치 로그 · fanarena.kr" };

// 액션 코드 → 한글 라벨 + 색
const ACTIONS: Record<string, { label: string; cls: string }> = {
  BLIND_COMMENT: { label: "코멘트 블라인드", cls: "text-amber-700 bg-amber-50" },
  UNBLIND_COMMENT: { label: "코멘트 복구", cls: "text-green-700 bg-green-50" },
  DELETE_COMMENT: { label: "코멘트 삭제", cls: "text-red-700 bg-red-50" },
  BLIND_DISCUSSION: { label: "토론 블라인드", cls: "text-amber-700 bg-amber-50" },
  UNBLIND_DISCUSSION: { label: "토론 복구", cls: "text-green-700 bg-green-50" },
  DELETE_DISCUSSION: { label: "토론 삭제", cls: "text-red-700 bg-red-50" },
  CREATE_MATCH: { label: "경기 생성", cls: "text-blue-700 bg-blue-50" },
  EDIT_MATCH: { label: "경기 수정", cls: "text-blue-700 bg-blue-50" },
  DELETE_MATCH: { label: "경기 삭제", cls: "text-red-700 bg-red-50" },
  EDIT_STANDINGS: { label: "순위 수정", cls: "text-gray-700 bg-gray-100" },
  SYNC_STANDINGS: { label: "순위 동기화", cls: "text-gray-700 bg-gray-100" },
  EDIT_ROSTER: { label: "로스터 수정", cls: "text-gray-700 bg-gray-100" },
  EDIT_PLAYER: { label: "선수 수정", cls: "text-gray-700 bg-gray-100" },
  SET_TEAM_COLOR: { label: "팀색 지정", cls: "text-gray-700 bg-gray-100" },
  RESET_TEAM_COLOR: { label: "팀색 초기화", cls: "text-gray-700 bg-gray-100" },
  EDIT_KBO_LINEUP: { label: "KBO 라인업", cls: "text-gray-700 bg-gray-100" },
  EDIT_LCK_LINEUP: { label: "LCK 라인업", cls: "text-gray-700 bg-gray-100" },
  SYNC_EPL_GOALS: { label: "EPL 골 동기화", cls: "text-gray-700 bg-gray-100" },
};

function fmt(d: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    hour12: false, timeZone: "Asia/Seoul",
  }).format(d);
}

export default async function AdminLogsPage() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") redirect("/");

  const logs = await prisma.adminLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 });

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">🧾 관리자 조치 로그</h1>
      <p className="text-sm text-gray-500 mb-4">최근 200건 · 블라인드·삭제·수정 등 관리자 행동 기록 (분쟁 대응용)</p>

      {logs.length === 0 ? (
        <p className="text-sm text-gray-400 bg-white border rounded p-4">아직 기록된 조치가 없습니다.</p>
      ) : (
        <div className="bg-white border rounded-lg divide-y">
          {logs.map((l) => {
            const a = ACTIONS[l.action] || { label: l.action, cls: "text-gray-700 bg-gray-100" };
            return (
              <div key={l.id} className="flex items-start gap-2 px-3 py-2 text-sm">
                <span className="text-xs text-gray-400 shrink-0 w-20 pt-0.5">{fmt(l.createdAt)}</span>
                <span className={`text-[11px] rounded px-1.5 py-0.5 shrink-0 ${a.cls}`}>{a.label}</span>
                <span className="flex-1 min-w-0">
                  <span className="text-gray-700 break-all">{l.detail || l.targetType}</span>
                  {l.targetId && <span className="text-gray-300 text-xs"> · {l.targetId.slice(0, 8)}</span>}
                </span>
                <span className="text-xs text-gray-500 shrink-0">{l.adminName}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
