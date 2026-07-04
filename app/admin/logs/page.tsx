import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "관리자 조치 로그 · fanarena.kr" };

// 액션 코드 → 한글 라벨 + 색
const ACTIONS: Record<string, { label: string; cls: string }> = {
  BLIND_COMMENT: { label: "코멘트 블라인드", cls: "text-golddim bg-goldbg" },
  UNBLIND_COMMENT: { label: "코멘트 복구", cls: "text-emerald-300 bg-[#123120]" },
  DELETE_COMMENT: { label: "코멘트 삭제", cls: "text-[#ff9d8f] bg-[#3a1512]" },
  BLIND_DISCUSSION: { label: "토론 블라인드", cls: "text-golddim bg-goldbg" },
  UNBLIND_DISCUSSION: { label: "토론 복구", cls: "text-emerald-300 bg-[#123120]" },
  DELETE_DISCUSSION: { label: "토론 삭제", cls: "text-[#ff9d8f] bg-[#3a1512]" },
  CREATE_MATCH: { label: "경기 생성", cls: "text-golddim bg-goldbg" },
  EDIT_MATCH: { label: "경기 수정", cls: "text-golddim bg-goldbg" },
  DELETE_MATCH: { label: "경기 삭제", cls: "text-[#ff9d8f] bg-[#3a1512]" },
  EDIT_STANDINGS: { label: "순위 수정", cls: "text-wsub bg-wsoft" },
  SYNC_STANDINGS: { label: "순위 동기화", cls: "text-wsub bg-wsoft" },
  EDIT_ROSTER: { label: "로스터 수정", cls: "text-wsub bg-wsoft" },
  EDIT_PLAYER: { label: "선수 수정", cls: "text-wsub bg-wsoft" },
  SET_TEAM_COLOR: { label: "팀색 지정", cls: "text-wsub bg-wsoft" },
  RESET_TEAM_COLOR: { label: "팀색 초기화", cls: "text-wsub bg-wsoft" },
  EDIT_KBO_LINEUP: { label: "KBO 라인업", cls: "text-wsub bg-wsoft" },
  EDIT_LCK_LINEUP: { label: "LCK 라인업", cls: "text-wsub bg-wsoft" },
  SYNC_EPL_GOALS: { label: "EPL 골 동기화", cls: "text-wsub bg-wsoft" },
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
      <p className="text-sm text-wfaint mb-4">최근 200건 · 블라인드·삭제·수정 등 관리자 행동 기록 (분쟁 대응용)</p>

      {logs.length === 0 ? (
        <p className="text-sm text-wfaint bg-card border rounded p-4">아직 기록된 조치가 없습니다.</p>
      ) : (
        <div className="bg-card border rounded-lg divide-y">
          {logs.map((l) => {
            const a = ACTIONS[l.action] || { label: l.action, cls: "text-wsub bg-wsoft" };
            return (
              <div key={l.id} className="flex items-start gap-2 px-3 py-2 text-sm">
                <span className="text-xs text-wfaint shrink-0 w-20 pt-0.5">{fmt(l.createdAt)}</span>
                <span className={`text-[11px] rounded px-1.5 py-0.5 shrink-0 ${a.cls}`}>{a.label}</span>
                <span className="flex-1 min-w-0">
                  <span className="text-wsub break-all">{l.detail || l.targetType}</span>
                  {l.targetId && <span className="text-wmute text-xs"> · {l.targetId.slice(0, 8)}</span>}
                </span>
                <span className="text-xs text-wfaint shrink-0">{l.adminName}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
