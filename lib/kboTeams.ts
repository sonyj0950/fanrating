// KBO 10개 구단 (team 필드 표준값 = 약칭). 화면 표기는 라벨 사용.
export const KBO_TEAMS = ["LG", "한화", "KIA", "삼성", "두산", "KT", "SSG", "롯데", "NC", "키움"] as const;

export const KBO_TEAM_LABELS: Record<string, string> = {
  LG: "LG 트윈스", 한화: "한화 이글스", KIA: "KIA 타이거즈", 삼성: "삼성 라이온즈",
  두산: "두산 베어스", KT: "KT 위즈", SSG: "SSG 랜더스", 롯데: "롯데 자이언츠",
  NC: "NC 다이노스", 키움: "키움 히어로즈",
};

// 포지션 문자열로 투수/타자 분류 (관리자가 화면에서 토글해 교정 가능)
export function classifyPitcher(position?: string | null): boolean {
  const p = (position || "").trim();
  return /투|선발|마무리|불펜|중계|셋업|좌완|우완/.test(p);
}
