/** @type {import('next').NextConfig} */
const nextConfig = {
  // 공유 카드 PNG 생성(next/og)이 런타임에 읽는 Pretendard 폰트를
  // 서버리스 함수 번들에 포함시킨다 (Vercel nft 자동 추적이 fs 동적 읽기를 놓치므로 명시).
  experimental: {
    outputFileTracingIncludes: {
      "/api/share-card/[matchId]": ["./public/fonts/**"],
    },
  },
};
export default nextConfig;
