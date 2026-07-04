"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function WelcomePage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") { router.replace("/login"); return; }
    if (status !== "authenticated") return;
    fetch("/api/account/nickname")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j) return;
        if (j.nicknameSet) { router.replace("/"); return; } // 이미 설정됨 → 홈으로
        setReady(true);
      });
  }, [status, router]);

  async function submit(e: any) {
    e.preventDefault();
    setMsg("");
    if (nickname.trim().length < 2 || nickname.trim().length > 12) {
      setMsg("닉네임은 2~12자여야 합니다."); return;
    }
    setBusy(true);
    const res = await fetch("/api/account/nickname", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ nickname: nickname.trim() }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg(j.error || "설정에 실패했습니다."); return; }
    await update(); // 세션 닉네임 즉시 갱신
    router.push("/");
    router.refresh();
  }

  if (status === "loading" || !ready)
    return <p className="text-sm text-wfaint mt-10 text-center">불러오는 중…</p>;

  return (
    <div className="max-w-sm mx-auto mt-10 bg-card rounded-xl shadow p-6">
      <h1 className="text-xl font-bold mb-1">환영합니다! 👋</h1>
      <p className="text-sm text-wsub mb-4">사이트에서 사용할 닉네임을 정해주세요. (2~12자)</p>
      <form onSubmit={submit} className="space-y-3">
        <input
          className="border rounded w-full p-2"
          placeholder="닉네임"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={12}
          autoFocus
        />
        {msg && <p className="text-sm text-live">{msg}</p>}
        <button disabled={busy || !nickname.trim()}
          className="w-full bg-blue-600 text-white rounded py-2 disabled:opacity-40">
          시작하기
        </button>
      </form>
    </div>
  );
}
