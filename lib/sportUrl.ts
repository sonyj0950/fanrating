// 내부 sport 값 ↔ URL 세그먼트 매핑.
// DB의 Match.sport는 "kleague"로 유지하되, 사용자에게 보이는 URL은 /soccer 로 노출한다.
// 경기 페이지는 matchId로만 조회하고 [sport] 세그먼트를 검증하지 않으므로,
// 기존 /kleague/<id> 링크(북마크·OG 캐시)도 그대로 동작한다.
export function sportPath(sport: string): string {
  return sport === "kleague" ? "soccer" : sport;
}
