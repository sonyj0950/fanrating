/**
 * 축구 자동 토론 시드 생성기 (1단계: 규칙 기반)
 *
 * 입력: 한 경기의 선수별 평점 집계
 * 출력: 가장 "논쟁적인" 각도를 골라 만든 토론 시드 문장 (없으면 null)
 *
 * 파이프라인:
 *   평점 통계 계산 → 각 각도별 "논쟁 점수" 산출 → 최고 각도 선택 → 템플릿 채우기
 *
 * 논쟁 각도(축구 특화):
 *   1) 호불호(divisive)   — 표준편차가 가장 큰 선수 (평가가 갈림)
 *   2) POG 경합(close)    — 1·2위 평균차가 근소
 *   3) 최저(worst)        — 평균 최저 선수 (까임 대상)
 *   4) 팀 격차(teamgap)   — 홈/원정 팀 평균차가 큼
 *   5) 평점 vs 결과(mismatch) — 이긴 팀인데 평점이 낮거나, POG가 진 팀에서 나옴
 */

export type SeedRating = {
  playerId: string;
  name: string;
  team: string;
  score: number; // 1~10
};

export type SeedInput = {
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  ratings: SeedRating[]; // 총평(full) 기준 개별 평점들
  minRatingsPerPlayer?: number; // 선수별 최소 표본 (기본 3)
};

type PlayerStat = {
  playerId: string;
  name: string;
  team: string;
  avg: number;
  count: number;
  std: number; // 표준편차
};

function round(n: number, d = 1) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

// 선수별 평균·표준편차·표본수 집계
function aggregate(ratings: SeedRating[], minN: number): PlayerStat[] {
  const by: Record<string, { name: string; team: string; scores: number[] }> = {};
  for (const r of ratings) {
    (by[r.playerId] ||= { name: r.name, team: r.team, scores: [] }).scores.push(r.score);
  }
  const out: PlayerStat[] = [];
  for (const id of Object.keys(by)) {
    const { name, team, scores } = by[id];
    const n = scores.length;
    if (n < minN) continue;
    const avg = scores.reduce((a, b) => a + b, 0) / n;
    const variance = scores.reduce((a, b) => a + (b - avg) ** 2, 0) / n;
    out.push({ playerId: id, name, team, avg, count: n, std: Math.sqrt(variance) });
  }
  return out;
}

/**
 * 핵심: 통계에서 가장 논쟁적인 각도를 골라 시드 문장을 만든다.
 * 반환: 토론 시드 문자열 (충분한 데이터가 없으면 null)
 */
export function generateFootballSeed(input: SeedInput): string | null {
  const minN = input.minRatingsPerPlayer ?? 3;
  const stats = aggregate(input.ratings, minN);
  if (stats.length < 3) return null; // 표본이 너무 적으면 시드 생략

  const { homeTeam, awayTeam, homeScore, awayScore } = input;

  const sorted = [...stats].sort((a, b) => b.avg - a.avg);
  const best = sorted[0];
  const second = sorted[1];
  const worst = sorted[sorted.length - 1];
  const mostDivisive = [...stats].sort((a, b) => b.std - a.std)[0];

  const homeStats = stats.filter(s => s.team === homeTeam);
  const awayStats = stats.filter(s => s.team === awayTeam);
  const teamAvg = (arr: PlayerStat[]) =>
    arr.length ? arr.reduce((a, s) => a + s.avg, 0) / arr.length : null;
  const homeAvg = teamAvg(homeStats);
  const awayAvg = teamAvg(awayStats);

  // 각 각도별 "논쟁 점수"를 매기고 최고를 고른다
  type Angle = { kind: string; weight: number; text: () => string };
  const angles: Angle[] = [];

  // 1) 호불호 — 표준편차 큰 선수
  if (mostDivisive && mostDivisive.std >= 1.5) {
    angles.push({
      kind: "divisive",
      weight: mostDivisive.std, // 표준편차가 클수록 논쟁적
      text: () =>
        `🔥 ${mostDivisive.name}, 오늘 경기 평가가 극과 극으로 갈렸습니다 (평균 ${round(mostDivisive.avg)}). ` +
        `잘했다 vs 아쉬웠다, 여러분 점수는?`,
    });
  }

  // 2) POG 경합 — 1·2위 차이가 근소
  if (best && second) {
    const gap = best.avg - second.avg;
    if (gap <= 0.3) {
      angles.push({
        kind: "close_pog",
        weight: 2.0 + (0.3 - gap), // 차이 작을수록 가중
        text: () =>
          `🏆 오늘의 MOM 경합! ${best.name}(${round(best.avg)})와 ${second.name}(${round(second.avg)}), ` +
          `거의 차이가 없습니다. 진짜 MVP는 누구?`,
      });
    }
  }

  // 3) 최저 — 까임 대상
  if (worst && worst.avg <= 5.0) {
    angles.push({
      kind: "worst",
      weight: 1.5 + (5.0 - worst.avg), // 낮을수록 가중
      text: () =>
        `📉 ${worst.name}, 오늘 가장 아쉬운 평가를 받았습니다 (평균 ${round(worst.avg)}). ` +
        `이 점수, 과하다 vs 적당하다?`,
    });
  }

  // 4) 팀 격차
  if (homeAvg != null && awayAvg != null) {
    const gap = Math.abs(homeAvg - awayAvg);
    if (gap >= 1.0) {
      const better = homeAvg > awayAvg ? homeTeam : awayTeam;
      angles.push({
        kind: "team_gap",
        weight: 1.0 + gap,
        text: () =>
          `⚖️ 팀 평점 차이가 큽니다 — ${better} 우세 (${homeTeam} ${round(homeAvg)} vs ${awayTeam} ${round(awayAvg)}). ` +
          `동의하시나요?`,
      });
    }
  }

  // 5) 평점 vs 결과 불일치 — POG가 진 팀에서 나옴
  if (best && homeScore != null && awayScore != null && homeScore !== awayScore) {
    const winner = homeScore > awayScore ? homeTeam : awayTeam;
    if (best.team !== winner) {
      angles.push({
        kind: "mismatch",
        weight: 2.5, // 결과와 평점이 엇갈리면 강한 떡밥
        text: () =>
          `🤔 경기는 ${winner}가 이겼지만, 오늘 최고 평점은 진 팀의 ${best.name}(${round(best.avg)})입니다. ` +
          `결과와 별개로 베스트는 인정?`,
      });
    }
  }

  if (angles.length === 0) {
    // 폴백: 그냥 POG 발표
    if (best) return `🏆 오늘의 MOM은 ${best.name} (평균 ${round(best.avg)})! 여러분 생각도 같나요?`;
    return null;
  }

  // 논쟁 점수(weight) 최고 각도 선택
  angles.sort((a, b) => b.weight - a.weight);
  return angles[0].text();
}
