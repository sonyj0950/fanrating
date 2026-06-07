"use client";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

/**
 * 관리자 전용 경기 삭제 버튼.
 * - 관리자가 아니면 아무것도 렌더링하지 않음 (어디에 넣어도 안전)
 * - 홈의 "오늘의 경기 / 이전의 경기" 카드, 경기 상세 페이지 등에 그대로 사용
 * - 카드 전체가 <Link>여도 클릭이 전파되지 않도록 처리되어 있음
 */
export default function DeleteMatchButton({ matchId, afterDelete }:
  { matchId: string; afterDelete?: () => void }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if ((session?.user as any)?.role !== "admin") return null;

  async function del(e: any) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("이 경기를 삭제할까요?\n선수 명단·평점·코멘트가 모두 함께 삭제됩니다.")) return;
    setBusy(true);
    const res = await fetch(`/api/admin/match/${matchId}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert("삭제 실패: " + (j.error || res.status));
      return;
    }
    if (afterDelete) afterDelete();
    else router.refresh();
  }

  return (
    <button onClick={del} disabled={busy}
      className="text-xs px-2 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50 disabled:opacity-40 shrink-0">
      🗑 삭제
    </button>
  );
}
