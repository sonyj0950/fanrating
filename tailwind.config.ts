import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      // "미드나잇 그린" 디자인 토큰 — 평점 캡슐(다크 방송 그래픽) 기반 리브랜딩.
      // 토큰 이름은 크림&잉크 시절 그대로 두고 값만 교체 (ink=본문색은 이제 밝은 톤).
      colors: {
        paper: "#0d1512",   // 페이지 바탕 (야간 잔디빛 딥그린)
        card: "#152019",    // 카드 배경
        wline: "#24322a",   // 헤어라인 보더
        wsoft: "#1e2a22",   // 카드 내부 구분선
        ink: "#eaf2ec",     // 본문 텍스트 (밝음)
        wsub: "#8aa08f",    // 보조 텍스트
        wfaint: "#5e7365",  // 약한 텍스트
        wmute: "#3a4c40",   // 감산(패배팀 점수 등)
        deep: "#0d1512",    // 항상-어두운 색 (골드 칩 위 글자 등 배경 무관 고정)
        gold: "#f5b301",    // 브랜드 포인트
        golddim: "#e8c24a", // 골드 톤 텍스트 (다크 배경 위)
        goldbg: "#2b2410",  // 옅은 골드 배경 (다크 앰버 틴트)
        goldline: "#4a3e14",// 골드 배경 보더
        live: "#e85c42",    // LIVE (다크 위 밝은 적갈색)
        wgray: "#1e2c23",   // 배지 배경
        wgraytx: "#9db3a2", // 배지 텍스트
      },
      borderColor: {
        DEFAULT: "#24322a", // 클래스 없이 쓴 `border`의 기본색
      },
    },
  },
  plugins: [],
};
export default config;
