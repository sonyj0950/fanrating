"use client";

import { useId, type ReactNode } from "react";

let lastPulse = -Infinity;

export default function RatingSlider({ label, score, onChange, onClear, disabled, detailed = false, vibrate = true, action }:
  { label: string; score: number | null; onChange: (score: number) => void; onClear?: () => void;
    disabled?: boolean; detailed?: boolean; vibrate?: boolean; action?: ReactNode }) {
  const id = useId();
  const value = score ?? 5.5;

  function choose(next: number) {
    if (next === score || disabled) return;
    if (vibrate && score != null && typeof navigator.vibrate === "function") {
      const boundary = next > score ? Math.floor : Math.ceil;
      const now = performance.now();
      if (boundary(next) !== boundary(score) && now - lastPulse >= 40) {
        lastPulse = now;
        navigator.vibrate(9);
      }
    }
    onChange(next);
  }

  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold text-ink">{label}</label>
        {action && <span className="ml-auto">{action}</span>}
        <output htmlFor={id} className={`font-extrabold tabular-nums ${detailed ? "text-3xl" : "text-lg"} ${score == null ? "text-wfaint" : "text-golddim"}`}>
          {score == null ? "–" : score.toFixed(1)}
        </output>
        {onClear && score != null && <button type="button" disabled={disabled} aria-label={`${label} 입력 지우기`}
          onClick={onClear} className="min-w-7 text-wsub hover:text-ink">×</button>}
      </div>
      <div className="flex items-center gap-2">
        {detailed && <button type="button" aria-label={`${label} 0.1점 낮추기`}
          disabled={disabled || score === 1} onClick={() => choose(Math.max(10, Math.round(value * 10) - 1) / 10)}
          className="w-11 h-11 shrink-0 rounded-lg border border-wline bg-card text-xl font-bold disabled:opacity-40">−</button>}
        <input id={id} type="range" min={1} max={10} step={0.1} value={value} disabled={disabled}
          aria-valuetext={score == null ? "미선택" : `${score.toFixed(1)}점`}
          onChange={e => choose(e.currentTarget.valueAsNumber)}
          onPointerUp={e => { if (score == null) choose(e.currentTarget.valueAsNumber); }}
          onKeyDown={e => { if (score == null && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); choose(value); } }}
          className={`block w-full min-w-0 h-11 !bg-transparent touch-pan-y ${score == null ? "accent-wfaint" : "accent-golddim"} disabled:opacity-40`} />
        {detailed && <button type="button" aria-label={`${label} 0.1점 높이기`}
          disabled={disabled || score === 10} onClick={() => choose(Math.min(100, Math.round(value * 10) + 1) / 10)}
          className="w-11 h-11 shrink-0 rounded-lg border border-wline bg-card text-xl font-bold disabled:opacity-40">+</button>}
      </div>
      <div aria-hidden="true" className={`flex justify-between px-0.5 text-[11px] leading-none text-wsub tabular-nums ${detailed ? "mx-[52px]" : ""}`}>
        {Array.from({ length: 10 }, (_, index) => <span key={index} className="w-4 text-center">{index + 1}</span>)}
      </div>
    </div>
  );
}
