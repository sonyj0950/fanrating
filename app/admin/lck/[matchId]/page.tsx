import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import LckLineupEditor from "./LckLineupEditor";

export const metadata = { title: "LCK 라인업 편집 · fanarena.kr" };

export default async function LckLineupPage({ params }: { params: { matchId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") redirect("/");
  return <LckLineupEditor matchId={params.matchId} />;
}
