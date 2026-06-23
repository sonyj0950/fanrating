"use client";
import { useState } from "react";

type Fixture = {
  fixtureId: number;
  date: string;
  status: string;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  round: string;
};

type Player = { name: string; number: number | null; pos: string | null };
type Lineup = { team: string; formation: string; startXI: Player[]; substitutes: Player[] };

export default function EplTestPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fixtures, setFixtures] = useState<Fixture[] | null>(null);
  const [lineups, setLineups] = useState<Lineup[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  const [info, setInfo] = useState("");
  const [seasons, setSeasons] = useState<any[] | null>(null);
  const [importMsg, setImportMsg] = useState("");

  async function importFixture(fixtureId: number) {
    setImportMsg("등록 중…");
    try {
      const res = await fetch("/api/epl-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixtureId }),
      });
      const data = await res.json();
      if (!res.ok) { setImportMsg(`실패: ${data.error}${data.id ? ` (이미 등록됨)` : ""}`); return; }
      setImportMsg(`등록 완료! ${data.match} · 선수 ${data.players}명 · 경기페이지 ${data.url}`);
    } catch (e: any) { setImportMsg(`실패: ${e.message}`); }
  }

  async function loadSeasons() {
    setLoading(true); setError(""); setSeasons(null); setFixtures(null); setLineups(null);
    try {
      const res = await fetch("/api/epl-test?action=seasons");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류");
      setSeasons(data.seasons || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function loadFixtures(mode: string, season: string) {
    setLoading(true); setError(""); setLineups(null); setSelected(null); setInfo("");
    try {
      const res = await fetch(`/api/epl-test?mode=${mode}&season=${season}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류");
      setFixtures(data.fixtures || []);
      setInfo(`시즌 ${data.season} · ${data.mode === "last" ? "최근 끝난 경기" : "다가오는 경기"} ${data.count}건 (시즌 전체 ${data.total}경기)`);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function loadLineup(fixtureId: number) {
    setLoading(true); setError(""); setSelected(fixtureId);
    try {
      const res = await fetch(`/api/epl-test?fixtureId=${fixtureId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류");
      setLineups(data.lineups || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-gray-900">EPL 데이터 테스트</h1>
        <p className="text-sm text-gray-500 mt-1">
          API-Football에서 EPL 데이터를 받아오는지 확인합니다. (DB에 저장하지 않음)
        </p>
      </div>

      <button onClick={loadSeasons} disabled={loading}
        className="px-4 py-2 rounded bg-amber-500 text-gray-900 font-bold disabled:opacity-40">
        ⭐ 먼저 확인: 내 키로 받을 수 있는 EPL 시즌
      </button>

      {seasons && (
        <div className="border border-gray-300 rounded-xl overflow-hidden">
          <div className="bg-gray-900 text-white text-sm font-bold px-3 py-2">
            이용 가능한 EPL 시즌 {seasons.length}개
          </div>
          {seasons.map((s, i) => (
            <div key={i} className="px-3 py-2 border-t border-gray-100 text-sm flex items-center gap-2">
              <span className="font-bold text-gray-900">{s.year}/{(s.year+1)%100}</span>
              <span className="text-gray-400 text-xs">{s.start} ~ {s.end}</span>
              {s.current && <span className="text-xs bg-amber-100 text-amber-800 rounded px-1.5">진행중</span>}
              {s.lineups && <span className="text-xs bg-gray-100 text-gray-600 rounded px-1.5">라인업O</span>}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button onClick={() => loadFixtures("last", "2023")} disabled={loading}
          className="px-4 py-2 rounded bg-gray-900 text-white font-semibold disabled:opacity-40">
          2023시즌
        </button>
        <button onClick={() => loadFixtures("last", "2022")} disabled={loading}
          className="px-4 py-2 rounded bg-gray-900 text-white font-semibold disabled:opacity-40">
          2022시즌
        </button>
        <button onClick={() => loadFixtures("last", "2021")} disabled={loading}
          className="px-4 py-2 rounded bg-gray-900 text-white font-semibold disabled:opacity-40">
          2021시즌
        </button>
        <button onClick={() => loadFixtures("last", "2025")} disabled={loading}
          className="px-4 py-2 rounded border border-gray-900 text-gray-900 font-semibold disabled:opacity-40">
          2025시즌
        </button>
        <button onClick={() => loadFixtures("last", "2024")} disabled={loading}
          className="px-4 py-2 rounded border border-gray-900 text-gray-900 font-semibold disabled:opacity-40">
          2024시즌
        </button>
      </div>
      {loading && <p className="text-sm text-gray-500">불러오는 중…</p>}
      {info && <p className="text-xs text-gray-500">{info}</p>}

      {importMsg && (
        <div className="text-sm font-semibold text-gray-900 bg-amber-50 border border-amber-300 rounded-lg p-3">
          {importMsg}
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          오류: {error}
        </div>
      )}

      {fixtures && (
        <div className="border border-gray-300 rounded-xl overflow-hidden">
          <div className="bg-gray-900 text-white text-sm font-bold px-3 py-2">
            받아온 경기 {fixtures.length}개 — 라인업 보려면 경기 클릭
          </div>
          {fixtures.length === 0 && (
            <p className="text-sm text-gray-500 p-3">경기가 없습니다 (시즌/리그 확인 필요).</p>
          )}
          {fixtures.map(f => (
            <div key={f.fixtureId} className="border-t border-gray-100 px-3 py-2.5">
              <button onClick={() => loadLineup(f.fixtureId)}
                className={`w-full text-left hover:bg-amber-50 rounded ${selected===f.fixtureId?"bg-amber-50":""}`}>
                <div className="flex items-center gap-2 text-[15px] font-bold text-gray-900">
                  <span className="flex-1 text-right">{f.home}</span>
                  <span className="text-gray-400 text-sm shrink-0">
                    {f.homeScore != null ? `${f.homeScore} : ${f.awayScore}` : "vs"}
                  </span>
                  <span className="flex-1">{f.away}</span>
                </div>
                <div className="text-[11px] text-gray-400 mt-1 text-center">
                  {f.round} · {new Date(f.date).toLocaleString("ko-KR")} · {f.status}
                </div>
              </button>
              <div className="flex gap-2 mt-2">
                <button onClick={() => loadLineup(f.fixtureId)}
                  className="text-xs px-2.5 py-1 rounded border border-gray-300 text-gray-600">라인업 보기</button>
                <button onClick={() => importFixture(f.fixtureId)}
                  className="text-xs px-2.5 py-1 rounded bg-gray-900 text-white font-semibold">＋ 사이트에 등록</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {lineups && (
        <div className="space-y-3">
          <h2 className="text-sm font-extrabold text-gray-900">② 라인업 결과</h2>
          {lineups.length === 0 && (
            <p className="text-sm text-gray-500">
              라인업이 아직 없습니다. (보통 킥오프 30~60분 전에 확정됩니다.)
            </p>
          )}
          {lineups.map((lu, i) => (
            <div key={i} className="border border-gray-300 rounded-xl p-3">
              <div className="font-bold text-gray-900">
                {lu.team} <span className="text-gray-400 text-sm font-normal">({lu.formation})</span>
              </div>
              <div className="mt-2 text-sm">
                <div className="font-semibold text-gray-700">선발 XI</div>
                <ol className="text-gray-600 mt-1 space-y-0.5">
                  {lu.startXI.map((p, j) => (
                    <li key={j}>{p.number}. {p.name} <span className="text-gray-400">({p.pos})</span></li>
                  ))}
                </ol>
                <div className="font-semibold text-gray-700 mt-2">후보</div>
                <ol className="text-gray-600 mt-1 space-y-0.5">
                  {lu.substitutes.map((p, j) => (
                    <li key={j}>{p.number}. {p.name} <span className="text-gray-400">({p.pos})</span></li>
                  ))}
                </ol>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
