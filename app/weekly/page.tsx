import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getWeeklyBest } from "@/lib/weeklyBest";
import WeeklyClient from "./WeeklyClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "주간 베스트",
  description: "팬 평점으로 뽑은 이주의 베스트 — 축구 베스트 XI, KBO 베스트 나인, LoL 베스트 5.",
};

export default async function WeeklyPage({ searchParams }: { searchParams: { w?: string } }) {
  const raw = Number(searchParams?.w ?? 0);
  const offset = Number.isFinite(raw) ? Math.min(0, Math.max(-12, Math.trunc(raw))) : 0;

  const [best, colorRows] = await Promise.all([getWeeklyBest(offset), prisma.teamColor.findMany()]);
  const teamColors: Record<string, string> = {};
  for (const c of colorRows) teamColors[c.team] = c.color;

  return <WeeklyClient best={best} teamColors={teamColors} />;
}
