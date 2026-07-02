"use client";
import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);   // 약관·개인정보 동의
  const [ageOk, setAgeOk] = useState(false);    // 만 14세 이상
  const [msg, setMsg] = useState("");
  const [notice, setNotice] = useState("");     // 안내(초록)
  const [busy, setBusy] = useState(false);
  const [resendEmail, setResendEmail] = useState(""); // 인증 재발송 대상

  // 이메일 인증 링크에서 돌아온 결과 표시
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("verify");
    if (v === "success") setNotice("이메일 인증이 완료되었습니다. 로그인해 주세요.");
    else if (v === "expired") setMsg("인증 링크가 만료되었습니다. 로그인 후 재발송하거나 다시 가입해 주세요.");
    else if (v === "invalid") setMsg("유효하지 않은 인증 링크입니다.");
  }, []);

  async function submit(e: any) {
    e.preventDefault();
    setMsg(""); setNotice("");

    if (mode === "register") {
      if (!agree) { setMsg("이용약관 및 개인정보 처리방침에 동의해주세요."); return; }
      if (!ageOk) { setMsg("만 14세 이상만 가입할 수 있습니다."); return; }
    }

    setBusy(true);
    if (mode === "register") {
      const res = await fetch("/api/register", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, nickname, email, password }),
      });
      const j = await res.json();
      if (!res.ok) { setMsg(j.error); setBusy(false); return; }
      if (j.needsVerification) {
        setBusy(false);
        setResendEmail(email);
        setMode("login");
        setNotice("가입 완료! 인증 메일을 보냈습니다. 메일함(스팸함 포함)에서 인증을 완료한 뒤 로그인해 주세요.");
        return;
      }
    }

    const r = await signIn("credentials", { username, password, redirect: false });
    setBusy(false);
    if (r?.error) { setMsg("아이디 또는 비밀번호가 올바르지 않습니다. (잠시 후 다시 시도)"); return; }
    router.push("/");
    router.refresh();
  }

  async function resend() {
    if (!resendEmail) return;
    await fetch("/api/resend-verification", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: resendEmail }),
    });
    setNotice("인증 메일을 다시 보냈습니다. 메일함을 확인해 주세요.");
  }

  return (
    <div className="max-w-sm mx-auto mt-10 bg-white rounded-xl shadow p-6">
      <h1 className="text-xl font-bold mb-4">{mode === "login" ? "로그인" : "회원가입"}</h1>
      <form onSubmit={submit} className="space-y-3">
        <input className="border rounded w-full p-2" placeholder="아이디"
          value={username} onChange={e => setUsername(e.target.value)} />
        {mode === "register" && (
          <>
            <input className="border rounded w-full p-2" placeholder="닉네임 (2~12자, 사이트에 표시)"
              value={nickname} onChange={e => setNickname(e.target.value)} />
            <input className="border rounded w-full p-2" type="email" placeholder="이메일 (인증·비밀번호 찾기용)"
              value={email} onChange={e => setEmail(e.target.value)} />
          </>
        )}
        <input className="border rounded w-full p-2" type="password" placeholder="비밀번호"
          value={password} onChange={e => setPassword(e.target.value)} />

        {mode === "register" && (
          <div className="space-y-2 pt-1">
            <label className="flex items-start gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} className="mt-0.5" />
              <span>
                [필수]{" "}
                <a href="/terms" target="_blank" className="text-blue-600 underline">이용약관</a> 및{" "}
                <a href="/privacy" target="_blank" className="text-blue-600 underline">개인정보 처리방침</a>에 동의합니다.
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={ageOk} onChange={e => setAgeOk(e.target.checked)} className="mt-0.5" />
              <span>[필수] 만 14세 이상입니다.</span>
            </label>
          </div>
        )}

        {notice && <p className="text-sm text-green-600">{notice}</p>}
        {msg && <p className="text-sm text-red-500">{msg}</p>}
        <button disabled={busy}
          className="w-full bg-blue-600 text-white rounded py-2 disabled:opacity-40">
          {mode === "login" ? "로그인" : "가입하고 인증메일 받기"}
        </button>
      </form>

      {mode === "login" && resendEmail && (
        <button onClick={resend} className="mt-3 text-sm text-gray-500 hover:text-blue-600 block">
          인증 메일 다시 받기
        </button>
      )}

      <div className="mt-3 flex items-center justify-between text-sm">
        <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setMsg(""); setNotice(""); }}
          className="text-gray-500 hover:text-blue-600">
          {mode === "login" ? "계정이 없나요? 회원가입" : "이미 계정이 있나요? 로그인"}
        </button>
        {mode === "login" && (
          <Link href="/forgot-password" className="text-gray-500 hover:text-blue-600">비밀번호 찾기</Link>
        )}
      </div>
    </div>
  );
}
