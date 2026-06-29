/**
 * 공유 카드 데이터 + 캡션 생성기 (축구·야구·롤 공통)
 *
 * 한 경기의 선수별 평점에서:
 *   - MOM/MVP/POM (양팀 통틀어 최고 평점)
 *   - 팀별 최고 선수
 *   - 한 팀(focus = 홈팀) 기준 BEST / WORST + 격차
 *   - 팀 평균
 * 을 뽑아, 가로(MOM)·세로(BEST vs WORST) 카드와 X·인스타 캡션에 쓸 구조를 만든다.
 *
 * 이미지 라우트(서버)와 경기 페이지(UI)가 같은 함수를 호출해 일관성을 유지한다.
 */

import { LCK_LANES } from "./lckLanes";

// 카드 자동 노출 기준: 경기 총 평점 수가 이 값 이상이면 켠다.
export const SHARE_MIN_TOTAL = 30;

// LCK 라인 코드 → 카드 표기 (ADC=BOT, SPT=SUP)
const LANE_SHORT: Record<string, string> = { TOP: "TOP", JGL: "JGL", MID: "MID", ADC: "BOT", SPT: "SUP" };

export type LanePair = {
  code: string;
  short: string;
  home: { name: string; avg: number | null } | null;
  away: { name: string; avg: number | null } | null;
};

// 선수별 최고/최저 판정 시 최소 표본 (노이즈 방지). 부족하면 자동 완화.
const PLAYER_MIN_N = 2;

export type RatingRow = { playerId: string; score: number };

export type PlayerMeta = {
  playerId: string;
  name: string;
  team: string;
  role: string;
  isPitcher?: boolean | null;
};

export type MatchMeta = {
  id: string;
  sport: string; // kleague | epl | kbo | lck
  homeTeam: string;
  awayTeam: string;
  homeLabel: string; // teamLabel 적용된 표시명
  awayLabel: string;
  homeScore: number | null;
  awayScore: number | null;
  date: Date;
  round: string | null;
  status: string;
};

export type CardPick = {
  name: string;
  team: string;
  teamLabel: string;
  role: string;
  avg: number;
};

export type ShareCardData = {
  matchId: string;
  sport: string;
  homeTeam: string;
  awayTeam: string;
  homeLabel: string;
  awayLabel: string;
  homeScore: number | null;
  awayScore: number | null;
  dateText: string; // "2026. 6. 25."
  competition: string; // round 라벨 또는 종목 기본명
  scoreLabel: string; // "용 0 : 1 남아공" 형태에서 점수만 — UI가 조합
  totalRatings: number;
  eligible: boolean; // totalRatings >= SHARE_MIN_TOTAL

  momWord: string; // MOM | MVP | POM
  sportEmoji: string; // ⚽ ⚾ 🎮

  mom: CardPick | null;
  homeBest: CardPick | null;
  awayBest: CardPick | null;
  homeAvg: number | null;
  awayAvg: number | null;

  // 세로(BEST vs WORST) — focus = 홈팀
  focusTeam: string;
  focusLabel: string;
  best: CardPick | null;
  worst: CardPick | null;
  gap: number | null;
  focusAvg: number | null;

  // 세로(인스타) LCK 전용 — 라인별 1:1 맞대결 (홈=좌, 원정=우)
  lckLanes: LanePair[] | null;

  captionX: string;
  captionInsta: string;
};

const SPORT_EMOJI: Record<string, string> = { kleague: "⚽", epl: "⚽", kbo: "⚾", lck: "🎮" };
const SPORT_COMP: Record<string, string> = { kleague: "축구", epl: "EPL", kbo: "KBO 리그", lck: "LCK" };

function momWordOf(sport: string): string {
  if (sport === "kbo") return "MVP";
  if (sport === "lck") return "POM";
  return "MOM";
}

function r1(n: number): number {
  return Math.round(n * 10) / 10;
}
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

type Stat = { meta: PlayerMeta; avg: number; count: number };

function aggregate(players: PlayerMeta[], ratings: RatingRow[]): Stat[] {
  const sum: Record<string, { s: number; c: number }> = {};
  for (const r of ratings) {
    (sum[r.playerId] ||= { s: 0, c: 0 });
    sum[r.playerId].s += r.score;
    sum[r.playerId].c++;
  }
  const byId = new Map(players.map((p) => [p.playerId, p]));
  const out: Stat[] = [];
  for (const id of Object.keys(sum)) {
    const meta = byId.get(id);
    if (!meta) continue;
    const { s, c } = sum[id];
    out.push({ meta, avg: r1(s / c), count: c });
  }
  return out;
}

// 표본(count>=minN) 우선, 없으면 전체에서 비교 함수로 1명 고른다.
function pick(stats: Stat[], cmp: (a: Stat, b: Stat) => number): Stat | null {
  const strong = stats.filter((s) => s.count >= PLAYER_MIN_N);
  const pool = strong.length ? strong : stats;
  if (!pool.length) return null;
  return [...pool].sort(cmp)[0];
}

function toPick(s: Stat | null, m: MatchMeta): CardPick | null {
  if (!s) return null;
  const teamLabel = s.meta.team === m.homeTeam ? m.homeLabel : s.meta.team === m.awayTeam ? m.awayLabel : s.meta.team;
  return { name: s.meta.name, team: s.meta.team, teamLabel, role: roleText(m.sport, s.meta), avg: s.avg };
}

// 종목별 포지션/역할 표시 보정
function roleText(sport: string, meta: PlayerMeta): string {
  const role = (meta.role || "").trim();
  if (sport === "kbo") {
    const kind = meta.isPitcher === true ? "투수" : meta.isPitcher === false ? "타자" : "";
    if (kind && role) return `${kind} · ${role}`;
    if (kind) return kind;
  }
  return role;
}

function teamMean(stats: Stat[], team: string): number | null {
  const arr = stats.filter((s) => s.meta.team === team);
  if (!arr.length) return null;
  return r2(arr.reduce((a, s) => a + s.avg, 0) / arr.length);
}

function hashtag(s: string): string {
  return "#" + s.replace(/[\s.]/g, "");
}

function buildHashtags(m: MatchMeta): string {
  const sportTag = m.sport === "kbo" ? "#프로야구" : m.sport === "lck" ? "#LCK" : "#축구";
  return [hashtag(m.homeLabel), hashtag(m.awayLabel), sportTag, "#팬평점", "#fanarena"].join(" ");
}

function buildCaptions(m: MatchMeta, d: {
  momWord: string; emoji: string; mom: CardPick | null;
  homeBest: CardPick | null; awayBest: CardPick | null;
  homeAvg: number | null; awayAvg: number | null;
}): { x: string; insta: string } {
  const url = `https://fanarena.kr/${m.sport}/${m.id}`;
  const hs = m.homeScore ?? "-";
  const as = m.awayScore ?? "-";
  const head = `${d.emoji} ${SPORT_COMP[m.sport] ?? ""} 경기 종료 팬 평점 | ${m.homeLabel} ${hs}-${as} ${m.awayLabel}`;

  const momLine = d.mom ? `🏆 ${d.momWord} ${d.mom.name}(${d.mom.teamLabel}${d.mom.role ? "·" + d.mom.role : ""}) ${d.mom.avg.toFixed(1)}` : "";
  const bestLine =
    d.homeBest && d.awayBest
      ? `${m.homeLabel} 최고 ${d.homeBest.name} ${d.homeBest.avg.toFixed(1)} / ${m.awayLabel} 최고 ${d.awayBest.name} ${d.awayBest.avg.toFixed(1)}`
      : "";
  const avgLine =
    d.homeAvg != null && d.awayAvg != null
      ? `팀 평균 ${m.homeLabel} ${d.homeAvg.toFixed(1)} vs ${m.awayLabel} ${d.awayAvg.toFixed(1)}`
      : "";
  const tags = buildHashtags(m);

  const x = [head, "", momLine, bestLine, avgLine, "", "당신이라면 몇 점?👇", url, tags]
    .filter((l) => l !== null && l !== undefined)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");

  const insta = [
    head,
    "ㅤ",
    "오늘 경기, 팬들의 평가는 이렇게 나왔습니다.",
    momLine,
    bestLine ? `📊 ${bestLine}` : "",
    avgLine ? `⚖️ ${avgLine}` : "",
    "ㅤ",
    "이 점수, 동의하시나요? 여러분이 직접 매겨보세요.",
    "프로필 링크에서 평가 참여 👉 fanarena.kr",
    "ㅤ",
    tags,
  ]
    .filter((l) => l !== "")
    .join("\n");

  return { x, insta };
}

function buildLckLanes(m: MatchMeta, players: PlayerMeta[], avgById: Map<string, number>): LanePair[] {
  const findLane = (team: string, code: string) =>
    players.find((p) => p.team === team && (p.role || "").toUpperCase() === code);
  return LCK_LANES.map((l) => {
    const h = findLane(m.homeTeam, l.code);
    const a = findLane(m.awayTeam, l.code);
    return {
      code: l.code,
      short: LANE_SHORT[l.code] ?? l.code,
      home: h ? { name: h.name, avg: avgById.has(h.playerId) ? avgById.get(h.playerId)! : null } : null,
      away: a ? { name: a.name, avg: avgById.has(a.playerId) ? avgById.get(a.playerId)! : null } : null,
    };
  });
}

export function buildShareCardData(m: MatchMeta, players: PlayerMeta[], ratings: RatingRow[]): ShareCardData {
  const stats = aggregate(players, ratings);
  const total = ratings.length;
  const avgById = new Map(stats.map((s) => [s.meta.playerId, s.avg]));

  const mom = pick(stats, (a, b) => b.avg - a.avg || b.count - a.count);
  const homeStats = stats.filter((s) => s.meta.team === m.homeTeam);
  const awayStats = stats.filter((s) => s.meta.team === m.awayTeam);
  const homeBest = pick(homeStats, (a, b) => b.avg - a.avg || b.count - a.count);
  const awayBest = pick(awayStats, (a, b) => b.avg - a.avg || b.count - a.count);

  // 세로 카드 focus = 홈팀
  const best = pick(homeStats, (a, b) => b.avg - a.avg || b.count - a.count);
  const worst = pick(homeStats, (a, b) => a.avg - b.avg || b.count - a.count);

  const homeAvg = teamMean(stats, m.homeTeam);
  const awayAvg = teamMean(stats, m.awayTeam);

  const momPick = toPick(mom, m);
  const homeBestPick = toPick(homeBest, m);
  const awayBestPick = toPick(awayBest, m);
  const bestPick = toPick(best, m);
  const worstPick = toPick(worst, m);

  const emoji = SPORT_EMOJI[m.sport] ?? "🏟";
  const momWord = momWordOf(m.sport);

  const gap = bestPick && worstPick ? r1(bestPick.avg - worstPick.avg) : null;

  const dateText = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(m.date);

  const competition = (m.round && m.round.trim()) || SPORT_COMP[m.sport] || "";

  const { x, insta } = buildCaptions(m, {
    momWord,
    emoji,
    mom: momPick,
    homeBest: homeBestPick,
    awayBest: awayBestPick,
    homeAvg,
    awayAvg,
  });

  // LCK는 세로(인스타) 카드를 라인별 맞대결로 → 캡션도 라인별로 교체
  const lckLanes = m.sport === "lck" ? buildLckLanes(m, players, avgById) : null;
  let captionInsta = insta;
  if (lckLanes) {
    const sc = (v: number | null) => (v != null ? v.toFixed(1) : "-");
    const laneLines = lckLanes
      .filter((l) => l.home || l.away)
      .map((l) => {
        const h = l.home ? `${l.home.name} ${sc(l.home.avg)}` : "-";
        const a = l.away ? `${l.away.name} ${sc(l.away.avg)}` : "-";
        return `${l.short} ${h} vs ${a}`;
      });
    const hs = m.homeScore ?? "-";
    const as = m.awayScore ?? "-";
    captionInsta = [
      `${emoji} LCK ${competition} 팬 평점 | ${m.homeLabel} ${hs}-${as} ${m.awayLabel}`,
      "ㅤ",
      "라인별 팬 평점 맞대결",
      ...laneLines,
      "ㅤ",
      "이 점수, 동의하시나요? 여러분이 직접 매겨보세요.",
      "프로필 링크에서 평가 참여 👉 fanarena.kr",
      "ㅤ",
      buildHashtags(m),
    ].join("\n");
  }

  return {
    matchId: m.id,
    sport: m.sport,
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    homeLabel: m.homeLabel,
    awayLabel: m.awayLabel,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    dateText,
    competition,
    scoreLabel: `${m.homeScore ?? "-"} : ${m.awayScore ?? "-"}`,
    totalRatings: total,
    eligible: total >= SHARE_MIN_TOTAL && m.status === "finished",
    momWord,
    sportEmoji: emoji,
    mom: momPick,
    homeBest: homeBestPick,
    awayBest: awayBestPick,
    homeAvg,
    awayAvg,
    focusTeam: m.homeTeam,
    focusLabel: m.homeLabel,
    best: bestPick,
    worst: worstPick,
    gap,
    focusAvg: homeAvg,
    lckLanes,
    captionX: x,
    captionInsta,
  };
}
