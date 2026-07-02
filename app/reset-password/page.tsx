"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [msg, setMsg] = useState("");

  // 링크의 ?token= 을 읽는다 (useSearchParams의 Suspense 요구를 피하려고 window 사용)
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token") || "";
    setToken(t);
  }, []);

  async function submit(e: any) {
    e.preventDefault();
    setMsg("");
    if (password.length < 4) { setMsg("비밀번호는 4자 이상이어야 합니다."); return; }
    if (password !== confirm) { setMsg("비밀번호가 일치하지 않습니다."); return; }

    setBusy(true);
    const res = await fetch("/api/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(j.error || "재설정에 실패했습니다."); return; }
    setDone(true);
  }

  return (
    <div className="max-w-sm mx-auto mt-10 bg-white rounded-xl shadow p-6">
      <h1 className="text-xl font-bold mb-4">비밀번호 재설정</h1>
      {done ? (
        <div className="text-sm text-gray-700 space-y-3">
          <p>비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주세요.</p>
          <button onClick={() => router.push("/login")} className="w-full bg-blue-600 text-white rounded py-2">
            로그인하기
          </button>
        </div>
      ) : !token ? (
        <div className="text-sm text-gray-700 space-y-3">
          <p className="text-red-500">유효하지 않은 접근입니다. 이메일의 재설정 링크로 다시 접속해 주세요.</p>
          <Link href="/forgot-password" className="text-blue-600 underline">비밀번호 찾기</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <input
            className="border rounded w-full p-2"
            type="password"
            placeholder="새 비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            className="border rounded w-full p-2"
            type="password"
            placeholder="새 비밀번호 확인"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {msg && <p className="text-sm text-red-500">{msg}</p>}
          <button disabled={busy} className="w-full bg-blue-600 text-white rounded py-2 disabled:opacity-40">
            비밀번호 변경
          </button>
        </form>
      )}
    </div>
  );
}
