import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      // 3안 "크림 & 잉크" 디자인 토큰
      colors: {
        paper: "#f7f5ef",   // 페이지 바탕 (크림)
        card: "#fffdf8",    // 카드 배경
        wline: "#e2ddcf",   // 웜 헤어라인 보더
        wsoft: "#f0ede2",   // 카드 내부 구분선
        ink: "#1a1a1a",     // 본문 잉크
        wsub: "#8d8672",    // 보조 텍스트
        wfaint: "#a49d8b",  // 약한 텍스트
        wmute: "#cdc7b6",   // 감산(패배팀 점수 등)
        gold: "#f5b301",    // 브랜드 포인트
        golddim: "#8a6d00", // 골드 위 텍스트
        goldbg: "#fdf3d0",  // 옅은 골드 배경
        goldline: "#ecd98a",// 골드 배경 보더
        live: "#c8442c",    // LIVE 적갈색
        wgray: "#efece2",   // 웜 그레이 배지 배경
        wgraytx: "#7d7663", // 웜 그레이 배지 텍스트
      },
    },
  },
  plugins: [],
};
export default config;
