/**
 * 공유 카드 PNG 레이아웃 (next/og · satori) — 라이트 테마 (사이트 색에 맞춤)
 *
 * 사이트: 크림 배경(#f7f5ef) · 검정 텍스트 · 앰버(#f5b301) 액센트 · 흰 카드 + 회색 보더.
 * satori는 컬러 이모지·아이콘 폰트를 못 그리므로 텍스트 + 색 블록으로만 구성.
 * 모든 컨테이너는 명시적 display:flex (satori 요구사항).
 */
import { readFileSync } from "fs";
import { join } from "path";
import type { ReactNode } from "react";
import type { ShareCardData, CardPick } from "./shareCard";
import { teamColor, DEFAULT_HOME, DEFAULT_AWAY, OFFICIAL_TEAM_COLORS } from "./teamColors";

// 라우트에서 미리 받아온 국기 data URI (국대만, 없으면 null → 구단 색 배지)
export type Flags = { home?: string | null; away?: string | null; focus?: string | null };

// ── 라이트 팔레트 ──
export const CARD_BG = "#ffffff"; // 카드 배경 (흰색)
const CREAM = "#f7f5ef"; // 사이트 페이지색 (박스 배경)
const BOX_BORDER = "#e5e7eb"; // 박스 테두리 (gray-200)
const LINE = "#ededed"; // 구분선
const INK = "#1a1a1a"; // 기본 텍스트
const INK2 = "#4b5563"; // 보조 텍스트 (gray-600)
const MUTED = "#6b7280"; // 흐린 텍스트 (gray-500)
const SUBTLE = "#9ca3af"; // 더 흐린 (gray-400)
const GOLD = "#d97706"; // MOM 숫자 (amber-600)
const AMBER = "#f5b301"; // 브랜드 옐로 (배지 채움)
const GREEN = "#16a34a";
const RED = "#dc2626";

let fontCache: { name: string; data: Buffer; weight: 400 | 700; style: "normal" }[] | null = null;

export function loadShareFonts() {
  if (fontCache) return fontCache;
  const dir = join(process.cwd(), "public", "fonts");
  fontCache = [
    { name: "Pretendard", data: readFileSync(join(dir, "Pretendard-Regular.woff")), weight: 400, style: "normal" },
    { name: "Pretendard", data: readFileSync(join(dir, "Pretendard-Bold.woff")), weight: 700, style: "normal" },
  ];
  return fontCache;
}

const SPORT_BADGE: Record<string, { label: string; bg: string; fg: string }> = {
  kleague: { label: "축구", bg: "#1f7a4d", fg: "#ffffff" },
  epl: { label: "EPL", bg: "#1f7a4d", fg: "#ffffff" },
  kbo: { label: "야구", bg: "#1f7a4d", fg: "#ffffff" },
  lck: { label: "LCK", bg: "#5b4bc4", fg: "#ffffff" },
};

function fmt(n: number, d = 1) {
  return n.toFixed(d);
}

// 선수 부가정보: 기록 우선, 없으면 포지션 (예: "1골 1도움" / "GK")
function pickTag(p: CardPick): string {
  return p.recordTag || p.role || "";
}

// 팀 마크: 국기(국대) → 색 엠블럼 배지(구단) → 없음
function TeamMark({ teamKey, flagSrc, size }: { teamKey: string; flagSrc?: string | null; size: number }) {
  if (flagSrc) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={flagSrc} width={Math.round(size * 1.45)} height={size} style={{ borderRadius: 6 }} alt="" />;
  }
  const color = OFFICIAL_TEAM_COLORS[teamKey];
  if (color) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: size + 10,
          height: size + 10,
          background: color,
          borderRadius: 11,
          fontSize: Math.round(size * 0.42),
          fontWeight: 700,
          color: "#fff",
        }}
      >
        {teamKey}
      </div>
    );
  }
  return null;
}

// ─────────────────────────── 가로형 (1200 × 630) MOM 카드 ───────────────────────────
export function LandscapeCard({ data: d, flags }: { data: ShareCardData; flags?: Flags }) {
  const badge = SPORT_BADGE[d.sport] ?? SPORT_BADGE.kleague;
  const homeColor = teamColor(d.homeTeam, undefined, DEFAULT_HOME);
  const awayColor = teamColor(d.awayTeam, undefined, DEFAULT_AWAY);
  const header = d.competition || "경기 종료 팬 평점";

  const smallBox = (label: string, main: ReactNode, flex = 1) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex,
        background: CREAM,
        border: `1px solid ${BOX_BORDER}`,
        borderRadius: 12,
        padding: "12px 16px",
        marginRight: 12,
      }}
    >
      <div style={{ fontSize: 18, color: MUTED }}>{label}</div>
      <div style={{ fontSize: 26, color: INK, fontWeight: 700, marginTop: 4 }}>{main}</div>
    </div>
  );

  return (
    <div
      style={{
        width: 1200,
        height: 630,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: CARD_BG,
        color: INK,
        fontFamily: "Pretendard",
        padding: "46px 52px",
      }}
    >
      {/* 상단 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              background: badge.bg,
              color: badge.fg,
              fontSize: 22,
              fontWeight: 700,
              padding: "6px 18px",
              borderRadius: 999,
              marginRight: 16,
            }}
          >
            {badge.label}
          </div>
          <div style={{ display: "flex", fontSize: 25, color: INK2, fontWeight: 700 }}>{header}</div>
        </div>
        <div style={{ display: "flex", fontSize: 22, color: MUTED }}>{d.dateText}</div>
      </div>

      {/* 스코어 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", flex: 1, justifyContent: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", marginRight: 16 }}>
            <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: INK }}>{d.homeLabel}</div>
            <div style={{ display: "flex", width: 92, height: 6, background: homeColor, borderRadius: 4, marginTop: 10 }} />
          </div>
          <TeamMark teamKey={d.homeTeam} flagSrc={flags?.home} size={48} />
        </div>
        <div style={{ display: "flex", fontSize: 80, fontWeight: 700, color: INK, padding: "0 36px" }}>{d.scoreLabel}</div>
        <div style={{ display: "flex", alignItems: "center", flex: 1, justifyContent: "flex-start" }}>
          <TeamMark teamKey={d.awayTeam} flagSrc={flags?.away} size={48} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", marginLeft: 16 }}>
            <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: INK }}>{d.awayLabel}</div>
            <div style={{ display: "flex", width: 92, height: 6, background: awayColor, borderRadius: 4, marginTop: 10 }} />
          </div>
        </div>
      </div>

      {/* MOM */}
      {d.mom && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "#fffaf0",
            border: `1px solid #fde7bf`,
            borderRadius: 14,
            padding: "16px 22px",
          }}
        >
          <div
            style={{
              display: "flex",
              background: AMBER,
              color: "#3a2c00",
              fontSize: 20,
              fontWeight: 700,
              padding: "6px 16px",
              borderRadius: 999,
              marginRight: 20,
            }}
          >
            {d.momWord}
          </div>
          <div style={{ display: "flex", fontSize: 38, fontWeight: 700, color: INK }}>{d.mom.name}</div>
          <div style={{ display: "flex", fontSize: 22, color: MUTED, marginLeft: 14 }}>
            {d.mom.teamLabel}
            {pickTag(d.mom) ? ` · ${pickTag(d.mom)}` : ""}
          </div>
          <div style={{ display: "flex", marginLeft: "auto", fontSize: 54, fontWeight: 700, color: GOLD }}>{fmt(d.mom.avg)}</div>
        </div>
      )}

      {/* 하단 3박스 */}
      <div style={{ display: "flex" }}>
        {smallBox(`${d.homeLabel} 최고`, d.homeBest ? `${d.homeBest.name} ${pickTag(d.homeBest) ? pickTag(d.homeBest) + " " : ""}${fmt(d.homeBest.avg)}` : "-")}
        {smallBox(`${d.awayLabel} 최고`, d.awayBest ? `${d.awayBest.name} ${pickTag(d.awayBest) ? pickTag(d.awayBest) + " " : ""}${fmt(d.awayBest.avg)}` : "-")}
        {smallBox(
          "팀 평균",
          d.homeAvg != null && d.awayAvg != null ? `${d.homeLabel} ${fmt(d.homeAvg)} · ${d.awayLabel} ${fmt(d.awayAvg)}` : "-",
          1.4,
        )}
      </div>

      {/* 푸터 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `1px solid ${LINE}`, paddingTop: 14 }}>
        <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: INK }}>fanarena.kr</div>
        <div style={{ display: "flex", fontSize: 20, color: MUTED }}>지금 평점 진행 중 · 당신의 점수는?</div>
      </div>
    </div>
  );
}

// ─────────────────────── 세로형 LCK (1080 × 1320) 라인별 1:1 맞대결 ───────────────────────
export function PortraitLckCard({ data: d, flags }: { data: ShareCardData; flags?: Flags }) {
  const lanes = (d.lckLanes ?? []).filter((l) => l.home || l.away);

  const scoreBox = (v: number | null, bg: string) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 130,
        height: 84,
        background: bg,
        borderRadius: 12,
        fontSize: 46,
        fontWeight: 700,
        color: "#fff",
      }}
    >
      {v != null ? fmt(v) : "-"}
    </div>
  );

  return (
    <div
      style={{
        width: 1080,
        height: 1320,
        display: "flex",
        flexDirection: "column",
        background: CARD_BG,
        color: INK,
        fontFamily: "Pretendard",
        padding: "52px 56px",
      }}
    >
      {/* 상단 */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 38, fontWeight: 700, color: INK }}>fanarena</div>
          <div style={{ display: "flex", fontSize: 20, color: MUTED, marginTop: 4 }}>팬 평점</div>
        </div>
        <div style={{ display: "flex", fontSize: 22, color: MUTED }}>{d.dateText}</div>
      </div>

      {/* 팀 + 스코어 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 30 }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 46, fontWeight: 700, color: INK, marginRight: 14 }}>{d.homeLabel}</div>
          <TeamMark teamKey={d.homeTeam} flagSrc={flags?.home} size={46} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 240 }}>
          <div style={{ display: "flex", fontSize: 24, color: MUTED }}>{d.competition}</div>
          <div style={{ display: "flex", fontSize: 52, fontWeight: 700, color: INK, marginTop: 4 }}>{d.scoreLabel}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <TeamMark teamKey={d.awayTeam} flagSrc={flags?.away} size={46} />
          <div style={{ display: "flex", fontSize: 46, fontWeight: 700, color: INK, marginLeft: 14 }}>{d.awayLabel}</div>
        </div>
      </div>

      {/* 라인별 행 */}
      <div style={{ display: "flex", flexDirection: "column", marginTop: 40 }}>
        {lanes.map((l) => (
          <div
            key={l.code}
            style={{ display: "flex", alignItems: "center", marginBottom: 22, borderBottom: `1px solid ${LINE}`, paddingBottom: 22 }}
          >
            <div style={{ display: "flex", flex: 1, justifyContent: "flex-end", fontSize: 34, color: INK, paddingRight: 22 }}>
              {l.home?.name ?? "-"}
            </div>
            {scoreBox(l.home?.avg ?? null, "#ef4444")}
            <div style={{ display: "flex", width: 96, justifyContent: "center", fontSize: 20, fontWeight: 700, color: MUTED }}>
              {l.short}
            </div>
            {scoreBox(l.away?.avg ?? null, "#3b82f6")}
            <div style={{ display: "flex", flex: 1, justifyContent: "flex-start", fontSize: 34, color: INK, paddingLeft: 22 }}>
              {l.away?.name ?? "-"}
            </div>
          </div>
        ))}
      </div>

      {/* 푸터 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `1px solid ${LINE}`, paddingTop: 20, marginTop: "auto" }}>
        <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: INK }}>fanarena.kr</div>
        <div style={{ display: "flex", fontSize: 22, color: MUTED }}>팬이 직접 매긴 평점</div>
      </div>
    </div>
  );
}

// ─────────────────── 세로형 (1080 × 1320) 팀별 BEST vs WORST (team당 1장) ───────────────────
export function PortraitCard({ data: d, team = "home", flags }: { data: ShareCardData; team?: "home" | "away"; flags?: Flags }) {
  const isHome = team === "home";
  const teamKey = isHome ? d.homeTeam : d.awayTeam;
  const label = isHome ? d.homeLabel : d.awayLabel;
  const flagSrc = isHome ? flags?.home : flags?.away;
  const best = isHome ? d.homeBest : d.awayBest;
  const worst = isHome ? d.homeWorst : d.awayWorst;
  const avg = isHome ? d.homeAvg : d.awayAvg;
  const gap = best && worst ? Math.round((best.avg - worst.avg) * 10) / 10 : null;

  const bigBox = (kind: "best" | "worst", badgeText: string, pick: CardPick | null) => {
    const ac = kind === "best" ? GREEN : RED;
    const fill = kind === "best" ? "#f0fdf4" : "#fef2f2";
    const numColor = kind === "best" ? GREEN : RED;
    return (
      <div style={{ display: "flex", flexDirection: "column", border: `2px solid ${ac}`, background: fill, borderRadius: 20, padding: "26px 30px" }}>
        <div style={{ display: "flex" }}>
          <div style={{ display: "flex", background: ac, color: "#fff", fontSize: 22, fontWeight: 700, padding: "6px 18px", borderRadius: 999 }}>
            {badgeText}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 14 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 60, fontWeight: 700, color: INK }}>{pick ? pick.name : "-"}</div>
            <div style={{ display: "flex", fontSize: 24, color: MUTED, marginTop: 10 }}>{pick ? pickTag(pick) : ""}</div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <div style={{ display: "flex", fontSize: 88, fontWeight: 700, color: numColor }}>{pick ? fmt(pick.avg) : "-"}</div>
            <div style={{ display: "flex", fontSize: 24, color: SUBTLE, paddingBottom: 16, marginLeft: 6 }}>/ 10</div>
          </div>
        </div>
      </div>
    );
  };

  const pill = (text: string) => (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div style={{ display: "flex", background: CREAM, border: `1px solid ${BOX_BORDER}`, color: INK2, fontSize: 24, fontWeight: 700, padding: "10px 24px", borderRadius: 999 }}>
        {text}
      </div>
    </div>
  );

  return (
    <div style={{ width: 1080, height: 1320, display: "flex", flexDirection: "column", background: CARD_BG, color: INK, fontFamily: "Pretendard", padding: "56px 60px" }}>
      {/* 헤더 */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: MUTED, letterSpacing: 3 }}>FAN RATINGS · 팬 평점</div>
        <div style={{ display: "flex", width: 90, height: 3, background: AMBER, marginTop: 14 }} />
      </div>

      {/* 스코어 + 대회 */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 28 }}>
        <div style={{ display: "flex", fontSize: 42, fontWeight: 700, color: INK }}>
          {d.homeLabel} {d.scoreLabel} {d.awayLabel}
        </div>
        <div style={{ display: "flex", fontSize: 24, color: MUTED, marginTop: 12 }}>{d.competition} · {d.dateText}</div>
      </div>

      {/* 대상 팀 */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 26 }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", marginRight: 16 }}>
            <TeamMark teamKey={teamKey} flagSrc={flagSrc} size={48} />
          </div>
          <div style={{ display: "flex", fontSize: 54, fontWeight: 700, color: INK }}>{label}</div>
        </div>
        <div style={{ display: "flex", fontSize: 28, fontWeight: 700, marginTop: 14 }}>
          <span style={{ color: GOLD }}>최고</span>
          <span style={{ color: MUTED, padding: "0 10px" }}>vs</span>
          <span style={{ color: GOLD }}>최저 평점</span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", marginTop: 30 }}>
        {bigBox("best", "BEST · 최고", best)}
        <div style={{ display: "flex", justifyContent: "center", padding: "14px 0" }}>{pill(`평점 격차 ${gap != null ? fmt(gap) : "-"}`)}</div>
        {bigBox("worst", "WORST · 최저", worst)}
        <div style={{ display: "flex", marginTop: 20 }}>{pill(`${label} 팀 평균 ${avg != null ? avg.toFixed(2) : "-"}`)}</div>
      </div>

      {/* 푸터 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `1px solid ${LINE}`, paddingTop: 20, marginTop: "auto" }}>
        <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: INK }}>fanarena.kr</div>
        <div style={{ display: "flex", fontSize: 22, color: MUTED }}>팬이 직접 매긴 평점</div>
      </div>
    </div>
  );
}
