import { getHomeData } from "./homeData";
import HomeClient from "./HomeClient";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getHomeData();
  return <HomeClient {...data} initialTab="all" />;
}
