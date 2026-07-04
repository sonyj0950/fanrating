"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { POSITIONS_BY_LINE } from "@/lib/soccerPositions";
import { ROUND_PRESETS } from "@/lib/roundPresets";
import { KBO_TEAMS, KBO_TEAM_LABELS } from "@/lib/kboTeams";
import { OFFICIAL_TEAM_COLORS, DEFAULT_HOME, DEFAULT_AWAY, badgeLabel, badgeTextColor } from "@/lib/teamColors";

export default function AdminForm() {
  const r = useRouter();
  const [f, setF] = useState({
    sport:"kbo", date: new Date(Date.now() + 9*3600*1000).toISOString().slice(0,16),
    homeTeam:"", awayTeam:"", homeScore:"", awayScore:"", status:"finished",
    round:"", players: ""
  });
  const [msg, setMsg] = useState("");

  // 팀 색 — 처음 등록하는 팀(공식색·오버라이드 모두 없음)이면 색 지정 UI 노출
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [homeColor, setHomeColor] = useState(DEFAULT_HOME);
  const [awayColor, setAwayColor] = useState(DEFAULT_AWAY);
  useEffect(() => {
    fetch("/api/admin/team-color").then(res => res.ok ? res.json() : null)
      .then(j => { if (j?.overrides) setOverrides(j.overrides); }).catch(() => {});
  }, []);
  const hasColor = (team: string) => overrides[team] != null || OFFICIAL_TEAM_COLORS[team] != null;
  const ht = f.homeTeam.trim(), at = f.awayTeam.trim();
  const needsHome = !!ht && !hasColor(ht);
  const needsAway = !!at && at !== ht && !hasColor(at);

  async function submit(e:any){ e.preventDefault();
    const res = await fetch("/api/admin/match",{ method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify(f) });
    const j = await res.json();
    if (!res.ok) { setMsg("실패: "+j.error); return; }
    // 첫 등록 팀 색 저장 (색 지정 UI가 떠 있던 팀만)
    const saveColor = (team: string, color: string) =>
      fetch("/api/admin/team-color", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ team, color }) });
    const jobs: Promise<any>[] = [];
    if (needsHome) jobs.push(saveColor(ht, homeColor));
    if (needsAway) jobs.push(saveColor(at, awayColor));
    if (jobs.length) {
      await Promise.all(jobs).catch(() => {});
      setOverrides(o => ({ ...o,
        ...(needsHome ? { [ht]: homeColor.toUpperCase() } : {}),
        ...(needsAway ? { [at]: awayColor.toUpperCase() } : {}) }));
    }
    setMsg("등록완료" + (jobs.length ? " · 팀 색 저장됨" : "")); r.refresh();
  }

  // 색 지정 한 줄 (배지 미리보기 + 컬러 피커)
  function ColorRow({ team, color, onChange }: { team: string; color: string; onChange: (c: string) => void }) {
    return (
      <div className="flex items-center gap-2.5">
        <span className="w-[26px] h-[26px] rounded-full grid place-items-center font-black text-[10px] shrink-0"
          style={{ background: color, color: badgeTextColor(color) }} aria-hidden="true">
          {badgeLabel(team)}
        </span>
        <span className="text-sm font-semibold flex-1 min-w-0 truncate">
          {team} <span className="text-[11px] text-golddim font-bold">첫 등록 팀</span>
        </span>
        <span className="text-[11px] text-wfaint font-mono">{color.toUpperCase()}</span>
        <input type="color" value={color.toLowerCase()} onChange={e => onChange(e.target.value)}
          className="w-9 h-7 p-0 border rounded cursor-pointer" aria-label={`${team} 팀 색`} />
      </div>
    );
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
    <form onSubmit={submit} className="bg-card rounded p-4 shadow grid grid-cols-2 gap-3">
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
      {(needsHome || needsAway) && (
        <div className="col-span-2 -mt-1 bg-paper border border-goldline rounded p-2.5 space-y-2">
          <p className="text-[11px] font-bold text-golddim">
            🎨 처음 등록하는 팀이에요 — 팀 색을 지정하면 평점 마커·배지·범례에 계속 적용됩니다. (등록 시 저장)
          </p>
          {needsHome && <ColorRow team={ht} color={homeColor} onChange={setHomeColor} />}
          {needsAway && <ColorRow team={at} color={awayColor} onChange={setAwayColor} />}
        </div>
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
                f.round === p ? "bg-gold text-deep border-goldline" : "bg-card text-wsub border-wline hover:bg-paper"}`}>
              {p}
            </button>
          ))}
          {f.round && (
            <button type="button" onClick={()=>setF({...f,round:""})}
              className="text-xs px-2 py-1 rounded-full border border-dashed border-wline text-wfaint hover:bg-paper">
              지우기
            </button>
          )}
        </div>
      )}
      <textarea className="border rounded p-2 col-span-2 h-40" placeholder={placeholder} value={f.players} onChange={e=>setF({...f,players:e.target.value})}/>
      {f.sport === "kleague" && (
        <details className="col-span-2 text-xs text-wsub bg-paper border rounded p-2">
          <summary className="cursor-pointer font-semibold">⚽ 축구 포지션 코드 보기</summary>
          <div className="mt-2 space-y-1">
            {POSITIONS_BY_LINE.map(g => (
              <div key={g.line} className="flex gap-2">
                <span className="w-20 shrink-0 text-wfaint">{g.label}</span>
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
