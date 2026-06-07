import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 코멘트(평점)에 대댓글 작성
export async function POST(req: Request, { params }: any) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const b = await req.json();
  const text = (b.text || "").trim();
  if (!text) return NextResponse.json({ error: "내용을 입력하세요." }, { status: 400 });
  if (text.length > 500)
    return NextResponse.json({ error: "500자 이하로 입력하세요." }, { status: 400 });

  const rating = await prisma.rating.findUnique({ where: { id: params.id } });
  if (!rating)
    return NextResponse.json({ error: "코멘트를 찾을 수 없습니다." }, { status: 404 });

  const reply = await prisma.reply.create({
    data: {
      ratingId: params.id,
      userId: (session.user as any).id,
      text,
    },
  });
  return NextResponse.json({ ok: true, id: reply.id });
}
