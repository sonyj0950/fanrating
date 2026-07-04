// 와이드 섹션 — 레이아웃의 max-w-3xl 안에서 탈출해 최대 72rem(1152px)까지 확장.
// 100vw 대신 min(72rem, 100vw - 2rem)을 써서 스크롤바 폭으로 인한 가로 오버플로를 피한다.
export default function Wide({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative left-1/2 -translate-x-1/2 w-[min(72rem,calc(100vw-2rem))]">
      {children}
    </div>
  );
}
