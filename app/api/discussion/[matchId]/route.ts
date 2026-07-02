import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { verificationBlock } from "@/lib/verified";

// 경기 토론 댓글 목록 (대댓글·좋아요·신고 포함)
export async function GET(req: Request, { params }: any) {
  const session = await getServerSession(authOptions);
  const isAdmin = (session?.user as any)?.role === "admin";
  const viewerId = (session?.user as any)?.id ?? null;

  const list = await prisma.discussionComment.findMany({
    where: { matchId: params.matchId },
    include: {
      user: { select: { nickname: true } },
      replies: { include: { user: { select: { nickname: true } } }, orderBy: { createdAt: "asc" } },
      reports: { select: { userId: true } },
      _count: { select: { likes: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const items = list.map(c => ({
    id: c.id,
    username: c.user.nickname,
    text: c.text,
    blinded: c.blinded,
    mine: viewerId ? c.userId === viewerId : false,
    likes: c._count.likes,
    reportCount: c.reports.length,
    reportedByMe: viewerId ? c.reports.some(r => r.userId === viewerId) : false,
    replies: c.replies.map(r => ({ id: r.id, username: r.user.nickname, text: r.text })),
    createdAt: c.createdAt,
  }))
  // 좋아요순 정렬
  .sort((a, b) => b.likes - a.likes);

  return NextResponse.json({ items, isAdmin });
}

// 토론 댓글 작성
export async function POST(req: Request, { params }: any) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const userId = (session.user as any).id;
  if (!(await rateLimit("write", `u:${userId}`)))
    return NextResponse.json({ error: "요청이 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  const blocked = await verificationBlock(userId);
  if (blocked) return NextResponse.json({ error: blocked }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const text = (b.text || "").toString().trim();
  if (!text) return NextResponse.json({ error: "내용을 입력해주세요." }, { status: 400 });
  if (text.length > 500) return NextResponse.json({ error: "500자 이내로 작성해주세요." }, { status: 400 });

  const match = await prisma.match.findUnique({ where: { id: params.matchId } });
  if (!match) return NextResponse.json({ error: "경기를 찾을 수 없습니다." }, { status: 404 });

  await prisma.discussionComment.create({
    data: { matchId: params.matchId, userId, text },
  });
  return NextResponse.json({ ok: true });
}
