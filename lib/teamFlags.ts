// 국가대표팀(팀명=국가 한글명) → flagcdn ISO 코드.
// 클럽팀(EPL·KBO·LCK)은 여기 없음 → 카드에서 팀 색 엠블럼 배지로 대체.

const FLAG: Record<string, string> = {
  // 아시아
  대한민국: "kr", 한국: "kr", 일본: "jp", 중국: "cn", 북한: "kp", "사우디아라비아": "sa", 사우디: "sa",
  이란: "ir", 호주: "au", 카타르: "qa", 이라크: "iq", "아랍에미리트": "ae", "우즈베키스탄": "uz",
  요르단: "jo", 오만: "om", 베트남: "vn", 태국: "th", "인도네시아": "id", "말레이시아": "my",
  바레인: "bh", 시리아: "sy", 레바논: "lb", 인도: "in", 팔레스타인: "ps", 쿠웨이트: "kw",
  // 유럽
  잉글랜드: "gb-eng", 스코틀랜드: "gb-sct", 웨일스: "gb-wls", 프랑스: "fr", 독일: "de", 스페인: "es",
  포르투갈: "pt", 네덜란드: "nl", 이탈리아: "it", 벨기에: "be", 크로아티아: "hr", 스위스: "ch",
  폴란드: "pl", 덴마크: "dk", 스웨덴: "se", 노르웨이: "no", 세르비아: "rs", 오스트리아: "at",
  체코: "cz", 우크라이나: "ua", 터키: "tr", "튀르키예": "tr", 그리스: "gr", 헝가리: "hu", 러시아: "ru",
  // 아메리카
  브라질: "br", "아르헨티나": "ar", 미국: "us", 멕시코: "mx", "우루과이": "uy", "콜롬비아": "co",
  칠레: "cl", 페루: "pe", 에콰도르: "ec", "파라과이": "py", 캐나다: "ca", "코스타리카": "cr",
  // 아프리카
  남아공: "za", "나이지리아": "ng", 가나: "gh", 세네갈: "sn", 모로코: "ma", 이집트: "eg",
  카메룬: "cm", "알제리": "dz", 튀니지: "tn", "코트디부아르": "ci", 말리: "ml",
};

export function flagCode(team: string | null | undefined): string | null {
  if (!team) return null;
  return FLAG[team.trim()] ?? null;
}

export function flagUrl(code: string): string {
  return `https://flagcdn.com/w160/${code}.png`;
}
