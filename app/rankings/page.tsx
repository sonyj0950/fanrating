import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getRankings, seasonLabels } from "@/lib/rankings";
import RankingsClient from "./RankingsClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "선수 랭킹",
  description: "팬 평점으로 뽑은 시즌 선수 랭킹 — EPL·축구·KBO·LoL 선수들의 평균 평점과 최근 폼을 한눈에.",
};

export default async function RankingsPage() {
  const bySport = await getRankings();
  const colorRows = await prisma.teamColor.findMany();
  const teamColors: Record<string, string> = {};
  for (const c of colorRows) teamColors[c.team] = c.color;

  return <RankingsClient bySport={bySport} seasons={seasonLabels()} teamColors={teamColors} />;
}
