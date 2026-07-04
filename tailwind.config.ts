import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      // 테마 토큰 — 값은 globals.css의 CSS 변수(RGB 트리플렛)에서.
      // 다크(미드나잇 그린) 기본, [data-theme="light"]는 라이트 세이지(W3).
      // deep·gold는 테마 무관 상수 (골드 칩 + 그 위 다크 글자).
      colors: {
        paper: "rgb(var(--paper) / <alpha-value>)",   // 페이지 바탕
        card: "rgb(var(--card) / <alpha-value>)",     // 카드 배경
        wline: "rgb(var(--wline) / <alpha-value>)",   // 헤어라인 보더
        wsoft: "rgb(var(--wsoft) / <alpha-value>)",   // 카드 내부 구분선
        ink: "rgb(var(--ink) / <alpha-value>)",       // 본문 텍스트
        wsub: "rgb(var(--wsub) / <alpha-value>)",     // 보조 텍스트
        wfaint: "rgb(var(--wfaint) / <alpha-value>)", // 약한 텍스트
        wmute: "rgb(var(--wmute) / <alpha-value>)",   // 감산(패배팀 점수 등)
        deep: "#0b1210",                               // 항상-어두운 색 (골드 칩 위 글자)
        gold: "#f5b301",                               // 브랜드 포인트 (칩·배지 채움)
        golddim: "rgb(var(--golddim) / <alpha-value>)", // 골드 톤 텍스트
        goldbg: "rgb(var(--goldbg) / <alpha-value>)",
        goldline: "rgb(var(--goldline) / <alpha-value>)",
        live: "rgb(var(--live) / <alpha-value>)",
        wgray: "rgb(var(--wgray) / <alpha-value>)",   // 배지 배경
        wgraytx: "rgb(var(--wgraytx) / <alpha-value>)", // 배지 텍스트
        well: "rgb(var(--well) / <alpha-value>)",     // 움푹한 표면 (세그먼트·캡슐·검색창)
      },
      borderColor: {
        DEFAULT: "rgb(var(--wline) / 1)", // 클래스 없이 쓴 `border`의 기본색
      },
    },
  },
  plugins: [],
};
export default config;
