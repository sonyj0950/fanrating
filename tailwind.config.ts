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
        paper: "#0b1210",   // 페이지 바탕 (야간 잔디빛 딥그린)
        card: "#1c2a23",    // 카드 배경 — 바탕보다 확실히 밝게(카드가 떠 보이도록)
        wline: "#3a4d41",   // 헤어라인 보더 — 다크에서 보이게
        wsoft: "#2a3a30",   // 카드 내부 구분선
        ink: "#eef4f0",     // 본문 텍스트 (밝음)
        wsub: "#a6bcae",    // 보조 텍스트 (읽히게 상향)
        wfaint: "#7d9285",  // 약한 텍스트 (감산이어도 읽히게)
        wmute: "#5b6f62",   // 감산(패배팀 점수 등) — 어둡되 실종 안 되게
        deep: "#0b1210",    // 항상-어두운 색 (골드 칩 위 글자 등 배경 무관 고정)
        gold: "#f5b301",    // 브랜드 포인트
        golddim: "#ecc659", // 골드 톤 텍스트 (다크 배경 위)
        goldbg: "#31290f",  // 옅은 골드 배경 (다크 앰버 틴트)
        goldline: "#574719",// 골드 배경 보더
        live: "#ef6349",    // LIVE (다크 위 밝은 적갈색)
        wgray: "#2a3a30",   // 배지 배경
        wgraytx: "#accdb8", // 배지 텍스트
      },
      borderColor: {
        DEFAULT: "#3a4d41", // 클래스 없이 쓴 `border`의 기본색
      },
    },
  },
  plugins: [],
};
export default config;
