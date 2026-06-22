import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export const revalidate = 3600; // 1시간마다 갱신

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://fanarena.kr";

  // 고정 페이지
  const staticPages: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "hourly", priority: 1 },
    { url: `${base}/login`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];

  // 경기 페이지 (DB에서 자동 수집)
  let matchPages: MetadataRoute.Sitemap = [];
  try {
    const matches = await prisma.match.findMany({
      select: { id: true, sport: true, date: true, createdAt: true },
      orderBy: { date: "desc" },
      take: 5000,
    });
    matchPages = matches.map(m => ({
      url: `${base}/${m.sport}/${m.id}`,
      lastModified: m.date ?? m.createdAt,
      changeFrequency: "daily" as const,
      priority: 0.7,
    }));
  } catch {
    // DB 접근 실패 시 고정 페이지만 반환
  }

  return [...staticPages, ...matchPages];
}
