import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// 회원가입(아이디·비밀번호·닉네임) — 첫 번째 가입자는 자동으로 관리자(admin)
export async function POST(req: Request) {
  const b = await req.json();
  const username = (b.username || "").trim();
  const nickname = (b.nickname || "").trim();
  const password = b.password || "";

  if (username.length < 2) return NextResponse.json({ error: "아이디는 2자 이상" }, { status: 400 });
  if (nickname.length < 2 || nickname.length > 12)
    return NextResponse.json({ error: "닉네임은 2~12자" }, { status: 400 });
  if (password.length < 4) return NextResponse.json({ error: "비밀번호는 4자 이상" }, { status: 400 });

  const idExists = await prisma.user.findUnique({ where: { username } });
  if (idExists) return NextResponse.json({ error: "이미 사용 중인 아이디입니다." }, { status: 400 });
  const nickExists = await prisma.user.findUnique({ where: { nickname } });
  if (nickExists) return NextResponse.json({ error: "이미 사용 중인 닉네임입니다." }, { status: 400 });

  const userCount = await prisma.user.count();
  const user = await prisma.user.create({
    data: {
      username,
      nickname,
      password: await bcrypt.hash(password, 10),
      role: userCount === 0 ? "admin" : "user",
    },
  });
  return NextResponse.json({ ok: true, id: user.id, role: user.role });
}
