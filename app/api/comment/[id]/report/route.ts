import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const AUTO_BLIND_THRESHOLD = 3; // 신고 누적 시 자동 블라인드 기준

// 코멘트 신고 (로그인 유저, 코멘트당 1회)
export async function POST(req: Request, { params }: any) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const userId = (session.user as any).id;
  const rating = await prisma.rating.findUnique({ where: { id: params.id } });
  if (!rating) return NextResponse.json({ error: "코멘트를 찾을 수 없습니다." }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const reason = (b.reason || "").toString().trim().slice(0, 200);

  // 본인 코멘트는 신고 불가
  if (rating.userId === userId)
    return NextResponse.json({ error: "본인 코멘트는 신고할 수 없습니다." }, { status: 400 });

  const existing = await prisma.report.findUnique({
    where: { ratingId_userId: { ratingId: params.id, userId } },
  });
  if (existing) return NextResponse.json({ error: "이미 신고한 코멘트입니다." }, { status: 400 });

  await prisma.report.create({ data: { ratingId: params.id, userId, reason } });

  // 신고 누적 시 자동 블라인드
  const count = await prisma.report.count({ where: { ratingId: params.id } });
  if (count >= AUTO_BLIND_THRESHOLD && !rating.blinded) {
    await prisma.rating.update({ where: { id: params.id }, data: { blinded: true } });
  }
  return NextResponse.json({ ok: true });
}
