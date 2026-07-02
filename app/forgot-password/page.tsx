"use client";
import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit(e: any) {
    e.preventDefault();
    setMsg("");
    setBusy(true);
    const res = await fetch("/api/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg(j.error || "요청 처리 중 오류가 발생했습니다.");
      return;
    }
    setDone(true);
  }

  return (
    <div className="max-w-sm mx-auto mt-10 bg-white rounded-xl shadow p-6">
      <h1 className="text-xl font-bold mb-4">비밀번호 찾기</h1>
      {done ? (
        <div className="text-sm text-gray-700 space-y-3">
          <p>입력하신 이메일로 가입된 계정이 있다면 비밀번호 재설정 링크를 보냈습니다. 메일함(스팸함 포함)을 확인해 주세요.</p>
          <Link href="/login" className="text-blue-600 underline">로그인으로 돌아가기</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <p className="text-sm text-gray-600">가입할 때 등록한 이메일 주소를 입력하면 재설정 링크를 보내드립니다.</p>
          <input
            className="border rounded w-full p-2"
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {msg && <p className="text-sm text-red-500">{msg}</p>}
          <button disabled={busy} className="w-full bg-blue-600 text-white rounded py-2 disabled:opacity-40">
            재설정 링크 받기
          </button>
          <Link href="/login" className="block text-sm text-gray-500 hover:text-blue-600">
            로그인으로 돌아가기
          </Link>
        </form>
      )}
    </div>
  );
}
