import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import KboLineupEditor from "./KboLineupEditor";

export const metadata = { title: "KBO 라인업 편집 · fanarena.kr" };

export default async function KboLineupPage({ params }: { params: { matchId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") redirect("/");
  return <KboLineupEditor matchId={params.matchId} />;
}
