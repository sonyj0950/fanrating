"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: any) {
    e.preventDefault();
    setMsg(""); setBusy(true);

    if (mode === "register") {
      const res = await fetch("/api/register", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, nickname, password }),
      });
      const j = await res.json();
      if (!res.ok) { setMsg(j.error); setBusy(false); return; }
    }

    const r = await signIn("credentials", { username, password, redirect: false });
    setBusy(false);
    if (r?.error) { setMsg("아이디 또는 비밀번호가 올바르지 않습니다."); return; }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="max-w-sm mx-auto mt-10 bg-white rounded-xl shadow p-6">
      <h1 className="text-xl font-bold mb-4">{mode === "login" ? "로그인" : "회원가입"}</h1>
      <form onSubmit={submit} className="space-y-3">
        <input className="border rounded w-full p-2" placeholder="아이디"
          value={username} onChange={e => setUsername(e.target.value)} />
        {mode === "register" && (
          <input className="border rounded w-full p-2" placeholder="닉네임 (2~12자, 사이트에 표시)"
            value={nickname} onChange={e => setNickname(e.target.value)} />
        )}
        <input className="border rounded w-full p-2" type="password" placeholder="비밀번호"
          value={password} onChange={e => setPassword(e.target.value)} />
        {msg && <p className="text-sm text-red-500">{msg}</p>}
        <button disabled={busy}
          className="w-full bg-blue-600 text-white rounded py-2 disabled:opacity-40">
          {mode === "login" ? "로그인" : "가입하고 로그인"}
        </button>
      </form>
      <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setMsg(""); }}
        className="mt-3 text-sm text-gray-500 hover:text-blue-600">
        {mode === "login" ? "계정이 없나요? 회원가입" : "이미 계정이 있나요? 로그인"}
      </button>
      <p className="mt-3 text-xs text-gray-400">※ 첫 번째로 가입한 계정이 관리자가 됩니다.</p>
    </div>
  );
}
