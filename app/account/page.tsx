"use client";
import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AccountPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // 프로필 공개 설정
  const [pub, setPub] = useState<boolean | null>(null);
  const [pubBusy, setPubBusy] = useState(false);

  // 비밀번호 변경
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/account/profile").then(r => r.ok ? r.json() : null).then(j => { if (j) setPub(j.profilePublic); });
  }, [status]);

  async function togglePublic(nextVal: boolean) {
    setPubBusy(true);
    const res = await fetch("/api/account/profile", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ profilePublic: nextVal }),
    });
    setPubBusy(false);
    if (res.ok) setPub(nextVal);
  }

  // 탈퇴
  const [delPw, setDelPw] = useState("");
  const [delMsg, setDelMsg] = useState("");
  const [delBusy, setDelBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  if (status === "loading") return <p className="text-sm text-wfaint">불러오는 중…</p>;
  if (!session) {
    return <p className="text-sm">로그인이 필요합니다. <a href="/login" className="text-golddim underline">로그인</a></p>;
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
      <p className="text-sm text-wsub">
        {(session.user as any)?.name}님 ·{" "}
        <Link href={`/u/${(session.user as any)?.id}`} className="text-golddim underline">내 프로필 보기</Link>
      </p>

      {/* 프로필 공개 설정 */}
      <section className="bg-card border rounded-lg p-4 space-y-2">
        <h2 className="font-semibold text-sm">프로필 공개</h2>
        <p className="text-xs text-wsub">공개하면 다른 이용자가 내 평점·통계를 볼 수 있습니다. 비공개하면 본인만 볼 수 있습니다.</p>
        <div className="flex items-center justify-between pt-1">
          <span className="text-sm">
            {pub === null ? "불러오는 중…" : pub ? "🌐 공개 중" : "🔒 비공개"}
          </span>
          <button
            onClick={() => pub !== null && togglePublic(!pub)}
            disabled={pubBusy || pub === null}
            className={`text-sm rounded px-4 py-1.5 disabled:opacity-40 ${pub ? "border" : "bg-blue-600 text-white"}`}>
            {pub ? "비공개로 전환" : "공개로 전환"}
          </button>
        </div>
      </section>

      {/* 비밀번호 변경 */}
      <section className="bg-card border rounded-lg p-4 space-y-2">
        <h2 className="font-semibold text-sm">비밀번호 변경</h2>
        <input type="password" className="border rounded w-full p-2 text-sm" placeholder="현재 비밀번호"
          value={cur} onChange={e => setCur(e.target.value)} />
        <input type="password" className="border rounded w-full p-2 text-sm" placeholder="새 비밀번호 (4자 이상)"
          value={next} onChange={e => setNext(e.target.value)} />
        {pwMsg && <p className={`text-xs ${pwMsg.includes("변경되") ? "text-emerald-300" : "text-live"}`}>{pwMsg}</p>}
        <button onClick={changePw} disabled={pwBusy || !cur || !next}
          className="bg-blue-600 text-white rounded px-4 py-1.5 text-sm disabled:opacity-40">변경</button>
      </section>

      {/* 회원 탈퇴 */}
      <section className="bg-card border border-red-200 rounded-lg p-4 space-y-2">
        <h2 className="font-semibold text-sm text-live">회원 탈퇴</h2>
        <p className="text-xs text-wsub">탈퇴 시 작성한 평점·코멘트·답글이 모두 삭제되며 복구할 수 없습니다.</p>
        {!confirmDel ? (
          <button onClick={() => setConfirmDel(true)}
            className="border border-[#5c2a2a] text-live rounded px-4 py-1.5 text-sm hover:bg-[#241310]">탈퇴하기</button>
        ) : (
          <div className="space-y-2">
            <input type="password" className="border rounded w-full p-2 text-sm" placeholder="비밀번호 확인"
              value={delPw} onChange={e => setDelPw(e.target.value)} />
            {delMsg && <p className="text-xs text-live">{delMsg}</p>}
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
