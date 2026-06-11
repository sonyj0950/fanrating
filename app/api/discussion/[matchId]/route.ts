import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 경기 토론 댓글 목록
export async function GET(req: Request, { params }: any) {
  const session = await getServerSession(authOptions);
  const isAdmin = (session?.user as any)?.role === "admin";
  const viewerId = (session?.user as any)?.id ?? null;

  const list = await prisma.discussionComment.findMany({
    where: { matchId: params.matchId },
    include: { user: { select: { nickname: true } } },
    orderBy: { createdAt: "desc" },
  });

  const items = list.map(c => ({
    id: c.id,
    username: c.user.nickname,
    text: c.text,
    blinded: c.blinded,
    mine: viewerId ? c.userId === viewerId : false,
    createdAt: c.createdAt,
  }));
  return NextResponse.json({ items, isAdmin });
}

// 토론 댓글 작성
export async function POST(req: Request, { params }: any) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const text = (b.text || "").toString().trim();
  if (!text) return NextResponse.json({ error: "내용을 입력해주세요." }, { status: 400 });
  if (text.length > 500) return NextResponse.json({ error: "500자 이내로 작성해주세요." }, { status: 400 });

  const match = await prisma.match.findUnique({ where: { id: params.matchId } });
  if (!match) return NextResponse.json({ error: "경기를 찾을 수 없습니다." }, { status: 404 });

  await prisma.discussionComment.create({
    data: { matchId: params.matchId, userId: (session.user as any).id, text },
  });
  return NextResponse.json({ ok: true });
}
