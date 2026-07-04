import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getHomeData } from "../homeData";
import HomeClient from "../HomeClient";

export const dynamic = "force-dynamic";

// URL 세그먼트 → 홈 탭 매핑. 구 URL(kbo·kleague·epl·lck)도 같은 탭으로 흡수.
const SEG_TAB: Record<string, "baseball" | "soccer" | "lol"> = {
  baseball: "baseball", kbo: "baseball",
  soccer: "soccer", kleague: "soccer", epl: "soccer",
  lol: "lol", lck: "lol",
};

const TAB_META: Record<string, { title: string; description: string }> = {
  baseball: { title: "야구", description: "KBO 경기 일정·결과와 팬 평점, 선수 MVP를 한눈에." },
  soccer: { title: "축구", description: "EPL·K리그·A매치 경기 일정·결과와 팬 평점, MOM을 한눈에." },
  lol: { title: "LoL", description: "LCK·국제전 경기 일정·결과와 팬 평점, POG를 한눈에." },
};

export function generateMetadata({ params }: { params: { sport: string } }): Metadata {
  const tab = SEG_TAB[params.sport];
  if (!tab) return {};
  const m = TAB_META[tab];
  return { title: m.title, description: m.description };
}

export default async function SportHome({ params }: { params: { sport: string } }) {
  const tab = SEG_TAB[params.sport];
  if (!tab) notFound();
  const data = await getHomeData();
  return <HomeClient {...data} initialTab={tab} />;
}
