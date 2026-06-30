"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { sportPath } from "@/lib/sportUrl";

export default function ReportsPage() {
  const { data: session, status } = useSession();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/reports");
    if (res.ok) { const j = await res.json(); setItems(j.items || []); }
    setLoading(false);
  }
  useEffect(() => { if (status === "authenticated") load(); }, [status]);

  if (status === "loading") return <p className="text-sm text-gray-400">불러오는 중…</p>;
  if (!session || (session.user as any)?.role !== "admin")
    return <p className="text-sm">관리자만 접근할 수 있습니다.</p>;

  async function setBlind(id: string, blinded: boolean) {
    setBusy(id);
    await fetch(`/api/admin/comment/${id}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ blinded }),
    });
    setBusy(null); load();
  }
  async function remove(id: string) {
    if (!confirm("이 코멘트를 삭제할까요? (평점 점수는 유지)")) return;
    setBusy(id);
    await fetch(`/api/admin/comment/${id}`, { method: "DELETE" });
    setBusy(null); load();
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">🚩 신고 관리</h1>
      <p className="text-sm text-gray-500 mb-4">신고가 접수된 코멘트 목록 (신고 많은 순)</p>

      {loading ? <p className="text-sm text-gray-400">불러오는 중…</p>
        : items.length === 0 ? <p className="text-sm text-gray-400 bg-white border rounded p-4">신고된 코멘트가 없습니다.</p>
        : (
          <div className="space-y-3">
            {items.map(it => (
              <div key={it.id} className={`border rounded-lg p-3 ${it.blinded ? "bg-gray-50" : "bg-white"}`}>
                <div className="flex justify-between items-start gap-2">
                  <div className="text-xs text-gray-500">
                    <Link href={`/${sportPath(it.sport)}/${it.matchId}`} className="text-blue-600 underline">{it.matchLabel}</Link>
                    {" · "}{it.player} · 작성자 {it.author}
                  </div>
                  <span className="text-xs font-bold text-red-500 shrink-0">🚩 {it.reportCount}</span>
                </div>
                <p className="text-sm mt-1 whitespace-pre-wrap">{it.text || <span className="text-gray-400 italic">(삭제된 코멘트)</span>}</p>
                {it.blinded && <p className="text-xs text-amber-600 mt-1">현재 블라인드 상태</p>}

                {it.reasons.length > 0 && (
                  <details className="mt-1">
                    <summary className="text-xs text-gray-400 cursor-pointer">신고 사유 보기</summary>
                    <ul className="text-xs text-gray-600 mt-1 space-y-0.5 pl-3">
                      {it.reasons.map((r: any, i: number) => (
                        <li key={i}>· {r.reason || "(사유 없음)"} <span className="text-gray-400">— {r.by}</span></li>
                      ))}
                    </ul>
                  </details>
                )}

                <div className="flex gap-3 mt-2">
                  {it.blinded
                    ? <button onClick={() => setBlind(it.id, false)} disabled={busy === it.id} className="text-xs text-green-600 hover:underline">복구</button>
                    : <button onClick={() => setBlind(it.id, true)} disabled={busy === it.id} className="text-xs text-amber-600 hover:underline">블라인드</button>}
                  <button onClick={() => remove(it.id)} disabled={busy === it.id} className="text-xs text-red-500 hover:underline">삭제</button>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
