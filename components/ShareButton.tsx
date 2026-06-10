"use client";
import { useState } from "react";

/**
 * 공유 버튼 — 모바일은 OS 공유 시트(Web Share API), 데스크톱은 링크 복사로 폴백.
 */
export default function ShareButton({ title, text, path, label = "공유", className }:
  { title: string; text?: string; path: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
    // 모바일 등 Web Share 지원 시 OS 공유 시트
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ title, text: text || title, url });
        return;
      } catch {
        // 사용자가 취소하면 무시
        return;
      }
    }
    // 폴백: 클립보드 복사
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      prompt("아래 링크를 복사하세요:", url);
    }
  }

  return (
    <button onClick={share}
      className={className ?? "text-xs px-2 py-1 border rounded bg-white hover:bg-gray-50"}>
      {copied ? "✓ 링크 복사됨" : `🔗 ${label}`}
    </button>
  );
}
