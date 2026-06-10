"use client";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function AccountPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // 비밀번호 변경
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  // 탈퇴
  const [delPw, setDelPw] = useState("");
  const [delMsg, setDelMsg] = useState("");
  const [delBusy, setDelBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  if (status === "loading") return <p className="text-sm text-gray-400">불러오는 중…</p>;
  if (!session) {
    return <p className="text-sm">로그인이 필요합니다. <a href="/login" className="text-blue-600 underline">로그인</a></p>;
  }

  async function changePw() {
    setPwMsg("");
    if (next.length < 4) { setPwMsg("새 비밀번호는 4자 이상이어야 합니다."); return; }
    setPwBusy(true);
    const res = await fetch("/api/account/password", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ current: cur, next }),
    });
    setPwBusy(false);
    const j = await res.json();
    if (!res.ok) { setPwMsg(j.error); return; }
    setPwMsg("비밀번호가 변경되었습니다.");
    setCur(""); setNext("");
  }

  async function deleteAccount() {
    setDelMsg(""); setDelBusy(true);
    const res = await fetch("/api/account/delete", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: delPw }),
    });
    setDelBusy(false);
    const j = await res.json();
    if (!res.ok) { setDelMsg(j.error); return; }
    alert("회원 탈퇴가 완료되었습니다.");
    await signOut({ callbackUrl: "/" });
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <h1 className="text-xl font-bold">내 계정</h1>
      <p className="text-sm text-gray-500">{(session.user as any)?.name}님</p>

      {/* 비밀번호 변경 */}
      <section className="bg-white border rounded-lg p-4 space-y-2">
        <h2 className="font-semibold text-sm">비밀번호 변경</h2>
        <input type="password" className="border rounded w-full p-2 text-sm" placeholder="현재 비밀번호"
          value={cur} onChange={e => setCur(e.target.value)} />
        <input type="password" className="border rounded w-full p-2 text-sm" placeholder="새 비밀번호 (4자 이상)"
          value={next} onChange={e => setNext(e.target.value)} />
        {pwMsg && <p className={`text-xs ${pwMsg.includes("변경되") ? "text-green-600" : "text-red-500"}`}>{pwMsg}</p>}
        <button onClick={changePw} disabled={pwBusy || !cur || !next}
          className="bg-blue-600 text-white rounded px-4 py-1.5 text-sm disabled:opacity-40">변경</button>
      </section>

      {/* 회원 탈퇴 */}
      <section className="bg-white border border-red-200 rounded-lg p-4 space-y-2">
        <h2 className="font-semibold text-sm text-red-600">회원 탈퇴</h2>
        <p className="text-xs text-gray-500">탈퇴 시 작성한 평점·코멘트·답글이 모두 삭제되며 복구할 수 없습니다.</p>
        {!confirmDel ? (
          <button onClick={() => setConfirmDel(true)}
            className="border border-red-300 text-red-600 rounded px-4 py-1.5 text-sm hover:bg-red-50">탈퇴하기</button>
        ) : (
          <div className="space-y-2">
            <input type="password" className="border rounded w-full p-2 text-sm" placeholder="비밀번호 확인"
              value={delPw} onChange={e => setDelPw(e.target.value)} />
            {delMsg && <p className="text-xs text-red-500">{delMsg}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setConfirmDel(false); setDelPw(""); setDelMsg(""); }}
                className="border rounded px-4 py-1.5 text-sm">취소</button>
              <button onClick={deleteAccount} disabled={delBusy || !delPw}
                className="bg-red-600 text-white rounded px-4 py-1.5 text-sm disabled:opacity-40">탈퇴 확정</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
