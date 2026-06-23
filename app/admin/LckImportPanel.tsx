"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Item = { id: string; label: string; date: string; state: "scheduled" | "live" | "finished" };

const STATE_BADGE: Record<string, { label: string; cls: string }> = {
  live: { label: "진행중", cls: "bg-red-100 text-red-600" },
  scheduled: { label: "예정", cls: "bg-gray-100 text-gray-500" },
  finished: { label: "종료", cls: "bg-blue-100 text-gray-700" },
};

export default function LckImportPanel() {
  const r = useRouter();
  const [items, setItems] = useState<Item[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  async function load() {
    setLoading(true); setMsg("");
    try {
      const res = await fetch("/api/lck-test");
      const j = await res.json();
      if (!res.ok) { setMsg("불러오기 실패: " + (j.error || "")); setItems([]); return; }
      setItems(j.matches || []);
    } catch (e: any) {
      setMsg("불러오기 실패: " + e.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function importOne(it: Item) {
    setBusyId(it.id); setMsg("");
    try {
      const res = await fetch("/api/lck-test", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ matchId: it.id }),
      });
      const j = await res.json();
      if (!res.ok) { setMsg(`실패: ${j.error || ""}`); return; }
      const verb = j.reason === "updated" ? "갱신" : "등록";
      setMsg(`${verb} 완료: ${j.match} (선수 ${j.players}명)${j.warning ? " — " + j.warning : ""}`);
      r.refresh();
    } catch (e: any) {
      setMsg("실패: " + e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="bg-white rounded p-4 shadow mb-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-bold">🎮 LCK 경기 가져오기 <span className="text-xs font-normal text-gray-500">(자동)</span></h2>
        <button onClick={load} disabled={loading}
          className="text-sm px-3 py-1 border rounded bg-gray-50 hover:bg-gray-100 disabled:opacity-40">
          {loading ? "불러오는 중…" : items ? "↻ 새로고침" : "경기 목록 불러오기"}
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        진행중·예정 경기는 미리 [등록]해두면 라이브 중 경기 페이지에서 세트 결과를 바로 입력할 수 있어요.
        세트가 끝난 뒤 [갱신]을 누르면 라인업·챔피언이 최신으로 채워집니다.
      </p>

      {msg && <p className="text-sm mb-3 bg-amber-50 border border-amber-200 rounded px-3 py-2">{msg}</p>}

      {items && items.length === 0 && !loading && (
        <p className="text-sm text-gray-400">표시할 경기가 없습니다. (비시즌이거나 일정 미정)</p>
      )}

      {items && items.length > 0 && (
        <div className="space-y-1.5 max-h-96 overflow-y-auto">
          {items.map(it => {
            const b = STATE_BADGE[it.state] ?? STATE_BADGE.scheduled;
            const d = new Date(it.date).toLocaleString("ko-KR", {
              timeZone: "Asia/Seoul", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
            });
            return (
              <div key={it.id} className="flex items-center gap-2 border rounded px-3 py-2 text-sm">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${b.cls}`}>{b.label}</span>
                <span className="flex-1 min-w-0 truncate font-medium">{it.label}</span>
                <span className="text-xs text-gray-400 shrink-0 hidden sm:inline">{d}</span>
                <button onClick={() => importOne(it)} disabled={busyId === it.id}
                  className="text-xs px-3 py-1 rounded bg-blue-600 text-white shrink-0 disabled:opacity-40">
                  {busyId === it.id ? "처리중…" : it.state === "finished" ? "등록/갱신" : "등록"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
