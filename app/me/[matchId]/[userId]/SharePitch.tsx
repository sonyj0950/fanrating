"use client";
import type { Player } from "../../../[sport]/[matchId]/types";
import SoccerField from "../../../[sport]/[matchId]/SoccerField";
import BaseballField from "../../../[sport]/[matchId]/BaseballField";
import LckLineup from "../../../[sport]/[matchId]/LckLineup";

// 공유 페이지용 읽기 전용 필드 — 내 점수를 avg 자리에 넣어 표시
export default function SharePitch({ sport, players, homeTeam, awayTeam, subs = [] }:
  { sport: string; players: Player[]; homeTeam: string; awayTeam: string;
    subs?: { minute: number; outPlayerId: string; inPlayerId: string }[] }) {
  const noop = () => {};
  const subInfo: Record<string, { dir: "in" | "out"; min: number }> = {};
  for (const s of subs) {
    if (s.inPlayerId && subInfo[s.inPlayerId] === undefined) subInfo[s.inPlayerId] = { dir: "in", min: s.minute };
    if (s.outPlayerId && subInfo[s.outPlayerId] === undefined) subInfo[s.outPlayerId] = { dir: "out", min: s.minute };
  }

  const isOfficial = (p: Player) => /심판|주심|부심|VAR/i.test(p.role || "");
  const isStaff = (p: Player) => /감독|코치/.test(p.role || "");
  const field = players.filter(p => !isOfficial(p) && !isStaff(p));
  const officials = players.filter(isOfficial);
  const home = field.filter(p => p.team === homeTeam);
  const away = field.filter(p => p.team === awayTeam);
  const homeStaff = players.filter(p => isStaff(p) && p.team === homeTeam);
  const awayStaff = players.filter(p => isStaff(p) && p.team === awayTeam);

  if (sport === "kleague") {
    return (
      <SoccerField home={home} away={away}
        homeStaff={homeStaff} awayStaff={awayStaff} officials={officials}
        homeTeam={homeTeam} awayTeam={awayTeam} onPick={noop}
        subs={subs} subInfo={subInfo} />
    );
  }
  if (sport === "lck") {
    return <LckLineup home={home} away={away} homeTeam={homeTeam} awayTeam={awayTeam} onPick={noop} />;
  }
  // 야구 등
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div>
        <h3 className="font-semibold mb-2">🏠 {homeTeam}</h3>
        <BaseballField players={home} onPick={noop} />
      </div>
      <div>
        <h3 className="font-semibold mb-2">✈️ {awayTeam}</h3>
        <BaseballField players={away} onPick={noop} />
      </div>
    </div>
  );
}
