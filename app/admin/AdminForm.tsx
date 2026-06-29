"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { POSITIONS_BY_LINE } from "@/lib/soccerPositions";
import { ROUND_PRESETS } from "@/lib/roundPresets";
import { KBO_TEAMS, KBO_TEAM_LABELS } from "@/lib/kboTeams";

export default function AdminForm() {
  const r = useRouter();
  const [f, setF] = useState({
    sport:"kbo", date: new Date(Date.now() + 9*3600*1000).toISOString().slice(0,16),
    homeTeam:"", awayTeam:"", homeScore:"", awayScore:"", status:"finished",
    round:"", players: ""
  });
  const [msg, setMsg] = useState("");

  async function submit(e:any){ e.preventDefault();
    const res = await fetch("/api/admin/match",{ method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify(f) });
    const j = await res.json();
    if (!res.ok) { setMsg("실패: "+j.error); return; }
    setMsg("등록완료"); r.refresh();
  }

  const placeholderKbo = `한 줄에 한 명: 이름,팀,포지션,역할,우선순위(P=우선/공란=벤치)
예) 김광현,LG,투수,선발,P
오지환,LG,내야수,유격수,P
박해민,LG,외야수,중견수

※ P 표시한 선수가 경기 화면에 우선 노출됩니다 (야구 우선 5명 등).`;

  const placeholderSoccer = `한 줄에 한 명: 이름,팀,포지션,역할,우선순위,출전(전/후/공란=전·후반)
예) 손흥민,서울,ST,최전방,P
이강인,서울,AM,플레이메이커,P,전
백승호,서울,CM,중원,,후
김기동,서울,스태프,감독
박진섭,수원,스태프,코치
김희곤,공통,스태프,주심

※ 포지션 칸에 코드(ST, CM, CB ...)를 넣으면 피치에 자동 배치됩니다. 한글(공격수/수비수 등)도 인식.
※ 역할에 감독/코치를 쓰면 필드 양 사이드, 주심/부심/심판은 필드 아래에 표시됩니다.
※ 마지막 칸 "전"/"후"를 쓰면 해당 하프에만 표시 — 등록 후 경기 화면의 "전/후반 명단 관리"에서도 변경 가능.`;

  const placeholder =
    f.sport === "kleague" ? placeholderSoccer : placeholderKbo;

  return (
    <form onSubmit={submit} className="bg-white rounded p-4 shadow grid grid-cols-2 gap-3">
      <select className="border rounded p-2" value={f.sport} onChange={e=>setF({...f,sport:e.target.value})}>
        <option value="kbo">국내야구</option>
        <option value="kleague">국내축구</option>
        <option value="lck">LCK</option>
      </select>
      <input className="border rounded p-2" type="datetime-local" value={f.date} onChange={e=>setF({...f,date:e.target.value})}/>
      {f.sport === "kbo" ? (
        <>
          <select className="border rounded p-2" value={f.homeTeam} onChange={e=>setF({...f,homeTeam:e.target.value})}>
            <option value="">홈팀 선택</option>
            {KBO_TEAMS.map(t => <option key={t} value={t}>{KBO_TEAM_LABELS[t]}</option>)}
          </select>
          <select className="border rounded p-2" value={f.awayTeam} onChange={e=>setF({...f,awayTeam:e.target.value})}>
            <option value="">원정팀 선택</option>
            {KBO_TEAMS.map(t => <option key={t} value={t}>{KBO_TEAM_LABELS[t]}</option>)}
          </select>
        </>
      ) : (
        <>
          <input className="border rounded p-2" placeholder="홈팀" value={f.homeTeam} onChange={e=>setF({...f,homeTeam:e.target.value})}/>
          <input className="border rounded p-2" placeholder="원정팀" value={f.awayTeam} onChange={e=>setF({...f,awayTeam:e.target.value})}/>
        </>
      )}
      <input className="border rounded p-2" placeholder="홈 점수" value={f.homeScore} onChange={e=>setF({...f,homeScore:e.target.value})}/>
      <input className="border rounded p-2" placeholder="원정 점수" value={f.awayScore} onChange={e=>setF({...f,awayScore:e.target.value})}/>
      <select className="border rounded p-2 col-span-2" value={f.status} onChange={e=>setF({...f,status:e.target.value})}>
        <option value="scheduled">예정</option>
        <option value="live">진행중</option>
        <option value="finished">종료</option>
      </select>
      <input className="border rounded p-2 col-span-2"
        placeholder="라운드/단계 (예: 프리미어리그 7라운드 · LCK 4라운드 · KBO 플레이오프 2차전)"
        value={f.round} onChange={e=>setF({...f,round:e.target.value})}/>
      {(ROUND_PRESETS[f.sport] ?? []).length > 0 && (
        <div className="col-span-2 -mt-1 flex flex-wrap gap-1.5">
          {ROUND_PRESETS[f.sport].map(p => (
            <button type="button" key={p} onClick={()=>setF({...f,round:p})}
              className={`text-xs px-2 py-1 rounded-full border transition ${
                f.round === p ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}>
              {p}
            </button>
          ))}
          {f.round && (
            <button type="button" onClick={()=>setF({...f,round:""})}
              className="text-xs px-2 py-1 rounded-full border border-dashed border-gray-300 text-gray-400 hover:bg-gray-50">
              지우기
            </button>
          )}
        </div>
      )}
      <textarea className="border rounded p-2 col-span-2 h-40" placeholder={placeholder} value={f.players} onChange={e=>setF({...f,players:e.target.value})}/>
      {f.sport === "kleague" && (
        <details className="col-span-2 text-xs text-gray-600 bg-gray-50 border rounded p-2">
          <summary className="cursor-pointer font-semibold">⚽ 축구 포지션 코드 보기</summary>
          <div className="mt-2 space-y-1">
            {POSITIONS_BY_LINE.map(g => (
              <div key={g.line} className="flex gap-2">
                <span className="w-20 shrink-0 text-gray-400">{g.label}</span>
                <span className="font-mono">{g.codes.join(" · ")}</span>
              </div>
            ))}
          </div>
        </details>
      )}
      <button className="bg-blue-600 text-white rounded py-2 col-span-2">경기 등록</button>
      {msg && <p className="col-span-2 text-sm">{msg}</p>}
    </form>
  );
}
