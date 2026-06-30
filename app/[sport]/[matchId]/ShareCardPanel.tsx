"use client";
import { useState } from "react";
import ShareButton from "@/components/ShareButton";
import type { ShareCardData } from "@/lib/shareCard";

/**
 * 공유 카드 패널 — 평점이 기준치(SHARE_MIN_TOTAL) 이상 모이면 노출.
 * 실제 생성되는 PNG를 그대로 미리보기로 띄우고, 캡션 복사 / 이미지 저장 / 링크 공유를 제공.
 * 성능: 펼치기 전에는 이미지를 로드하지 않는다.
 */
export default function ShareCardPanel({ data, canPreview = false }: { data: ShareCardData; canPreview?: boolean }) {
  const [open, setOpen] = useState(false);
  const [variant, setVariant] = useState<"landscape" | "portrait">("landscape");
  const [copied, setCopied] = useState<"x" | "insta" | null>(null);

  if (!data.eligible && !canPreview) return null;

  const imgSrc = `/api/share-card/${data.matchId}${variant === "portrait" ? "?v=portrait" : ""}`;
  const caption = variant === "portrait" ? data.captionInsta : data.captionX;

  async function copy(which: "x" | "insta") {
    const text = which === "insta" ? data.captionInsta : data.captionX;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      prompt("아래 문구를 복사하세요:", text);
    }
  }

  return (
    <div className="mb-4 rounded-2xl border border-[#2a3550] bg-[#0e1320] text-[#e9edf6] overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5">
        <span className="font-bold text-sm">
          📣 공유 카드 만들기
          {!data.eligible && canPreview && (
            <span className="ml-2 text-[11px] font-medium text-amber-300">미리보기 · 평점 {data.totalRatings}/30</span>
          )}
        </span>
        <span className="text-[#8a92ad] text-xs">{open ? "접기 ▲" : "열기 ▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4">
          {/* 포맷 전환 */}
          <div className="flex gap-2 mb-3">
            <FormatTab active={variant === "landscape"} onClick={() => setVariant("landscape")}
              title="가로 · X/링크용" />
            <FormatTab active={variant === "portrait"} onClick={() => setVariant("portrait")}
              title="세로 · 인스타용" />
          </div>

          {/* 실제 PNG 미리보기 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={variant}
            src={imgSrc}
            alt="공유 카드 미리보기"
            className="w-full rounded-xl border border-[#222a40] bg-[#0e1320]"
            style={{ aspectRatio: variant === "portrait" ? "1080 / 1320" : "1200 / 630" }}
          />

          {/* 캡션 — 관리자만 (공식 계정용 문구 관리) */}
          {canPreview && (
            <div className="mt-3">
              <div className="text-[11px] text-[#8a92ad] mb-1">
                {variant === "portrait" ? "인스타그램 캡션" : "X(트위터) 캡션"} <span className="text-amber-300">· 관리자 전용</span>
              </div>
              <textarea
                readOnly
                value={caption}
                className="w-full h-40 text-[12px] leading-relaxed rounded-lg bg-[#161d30] border border-[#2a3550] text-[#cfd6e6] p-2.5 resize-none"
              />
            </div>
          )}

          {/* 액션 */}
          <div className="flex flex-wrap gap-2 mt-3">
            {canPreview && (
              <button
                onClick={() => copy(variant === "portrait" ? "insta" : "x")}
                className="text-xs px-3 py-1.5 rounded-lg bg-[#5b9bf0] text-[#06223f] font-bold hover:opacity-90">
                {copied ? "✓ 복사됨" : "📋 캡션 복사"}
              </button>
            )}
            <a
              href={imgSrc}
              download={`fanarena-${data.matchId}-${variant}.png`}
              className="text-xs px-3 py-1.5 rounded-lg border border-[#39415a] text-[#cfd5e2] hover:bg-white/5">
              🖼 이미지 저장
            </a>
            <ShareButton
              dark
              title={`${data.homeLabel} ${data.scoreLabel} ${data.awayLabel} 팬 평점`}
              text="fanarena.kr에서 선수 평점을 매겨보세요!"
              path={`/${data.sport}/${data.matchId}`}
              label="링크 공유"
            />
          </div>

          <p className="text-[10px] text-[#5a6480] mt-3 leading-relaxed">
            인스타그램은 세로 이미지를 저장해 업로드하세요.
            X는 링크 공유 시 가로 카드가 자동으로 함께 표시됩니다.
            {canPreview && " 캡션은 관리자에게만 보입니다."}
          </p>
        </div>
      )}
    </div>
  );
}

function FormatTab({ active, onClick, title }: { active: boolean; onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 text-[12px] font-bold py-2 rounded-lg border transition ${
        active
          ? "bg-[#5b4bc4] text-white border-[#5b4bc4]"
          : "bg-[#161d30] text-[#aeb6cc] border-[#2a3550] hover:bg-white/5"
      }`}>
      {title}
    </button>
  );
}
