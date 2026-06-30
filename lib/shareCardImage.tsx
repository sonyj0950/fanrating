/**
 * 공유 카드 PNG 레이아웃 (next/og · satori)
 *
 * satori는 컬러 이모지·아이콘 폰트를 렌더하지 못하므로 텍스트 + 색 블록으로만 구성한다.
 * 모든 컨테이너는 명시적 display:flex (satori 요구사항).
 */
import { readFileSync } from "fs";
import { join } from "path";
import type { ReactNode } from "react";
import type { ShareCardData, CardPick } from "./shareCard";
import { teamColor, DEFAULT_HOME, DEFAULT_AWAY, OFFICIAL_TEAM_COLORS } from "./teamColors";

// 라우트에서 미리 받아온 국기 data URI (국대만, 없으면 null → 구단 색 배지)
export type Flags = { home?: string | null; away?: string | null; focus?: string | null };

export const CARD_BG = "#0e1320";
const BOX_BG = "#161d30";
const BOX_BORDER = "#2a3550";
const GOLD = "#f2c14e";
const GREEN = "#4ade80";
const RED = "#f87171";
const MUTED = "#8a92ad";
const SUBTLE = "#9fb0c0";

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
  kleague: { label: "축구", bg: "#1f7a4d", fg: "#eafff3" },
  epl: { label: "EPL", bg: "#1f7a4d", fg: "#eafff3" },
  kbo: { label: "야구", bg: "#1f7a4d", fg: "#eafff3" },
  lck: { label: "LCK", bg: "#5b4bc4", fg: "#efeaff" },
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
  const header = [d.competition].filter(Boolean).join("");

  const smallBox = (label: string, main: ReactNode, flex = 1) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex,
        background: BOX_BG,
        border: `1px solid ${BOX_BORDER}`,
        borderRadius: 12,
        padding: "12px 16px",
        marginRight: 12,
      }}
    >
      <div style={{ fontSize: 18, color: MUTED }}>{label}</div>
      <div style={{ fontSize: 26, color: "#fff", fontWeight: 700, marginTop: 4 }}>{main}</div>
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
        color: "#e9edf6",
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
          <div style={{ display: "flex", fontSize: 25, color: "#c2c9da", fontWeight: 700 }}>
            {header || "경기 종료 팬 평점"}
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 22, color: MUTED }}>{d.dateText}</div>
      </div>

      {/* 스코어 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", flex: 1, justifyContent: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", marginRight: 16 }}>
            <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: "#fff" }}>{d.homeLabel}</div>
            <div style={{ display: "flex", width: 92, height: 6, background: homeColor, borderRadius: 4, marginTop: 10 }} />
          </div>
          <TeamMark teamKey={d.homeTeam} flagSrc={flags?.home} size={48} />
        </div>
        <div style={{ display: "flex", fontSize: 80, fontWeight: 700, color: "#fff", padding: "0 36px" }}>
          {d.scoreLabel}
        </div>
        <div style={{ display: "flex", alignItems: "center", flex: 1, justifyContent: "flex-start" }}>
          <TeamMark teamKey={d.awayTeam} flagSrc={flags?.away} size={48} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", marginLeft: 16 }}>
            <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: "#fff" }}>{d.awayLabel}</div>
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
            background: BOX_BG,
            border: `1px solid ${BOX_BORDER}`,
            borderRadius: 14,
            padding: "16px 22px",
          }}
        >
          <div
            style={{
              display: "flex",
              background: GOLD,
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
          <div style={{ display: "flex", fontSize: 38, fontWeight: 700, color: "#fff" }}>{d.mom.name}</div>
          <div style={{ display: "flex", fontSize: 22, color: SUBTLE, marginLeft: 14 }}>
            {d.mom.teamLabel}
            {pickTag(d.mom) ? ` · ${pickTag(d.mom)}` : ""}
          </div>
          <div style={{ display: "flex", marginLeft: "auto", fontSize: 54, fontWeight: 700, color: GOLD }}>
            {fmt(d.mom.avg)}
          </div>
        </div>
      )}

      {/* 하단 3박스 */}
      <div style={{ display: "flex" }}>
        {smallBox(`${d.homeLabel} 최고`, d.homeBest ? `${d.homeBest.name} ${pickTag(d.homeBest) ? pickTag(d.homeBest) + " " : ""}${fmt(d.homeBest.avg)}` : "-")}
        {smallBox(`${d.awayLabel} 최고`, d.awayBest ? `${d.awayBest.name} ${pickTag(d.awayBest) ? pickTag(d.awayBest) + " " : ""}${fmt(d.awayBest.avg)}` : "-")}
        {smallBox(
          "팀 평균",
          d.homeAvg != null && d.awayAvg != null
            ? `${d.homeLabel} ${fmt(d.homeAvg)} · ${d.awayLabel} ${fmt(d.awayAvg)}`
            : "-",
          1.4,
        )}
      </div>

      {/* 푸터 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: `1px solid #222a40`,
          paddingTop: 14,
        }}
      >
        <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: "#cfd6e6" }}>fanarena.kr</div>
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
        background: "#0a0e18",
        color: "#e9edf6",
        fontFamily: "Pretendard",
        padding: "52px 56px",
      }}
    >
      {/* 상단 */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 38, fontWeight: 700, color: "#fff" }}>fanarena</div>
          <div style={{ display: "flex", fontSize: 20, color: "#7a8299", marginTop: 4 }}>팬 평점</div>
        </div>
        <div style={{ display: "flex", fontSize: 22, color: "#6f7790" }}>{d.dateText}</div>
      </div>

      {/* 팀 + 스코어 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 30 }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 46, fontWeight: 700, color: "#fff", marginRight: 14 }}>{d.homeLabel}</div>
          <TeamMark teamKey={d.homeTeam} flagSrc={flags?.home} size={46} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 240 }}>
          <div style={{ display: "flex", fontSize: 24, color: "#9aa3ba" }}>{d.competition}</div>
          <div style={{ display: "flex", fontSize: 52, fontWeight: 700, color: "#fff", marginTop: 4 }}>{d.scoreLabel}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <TeamMark teamKey={d.awayTeam} flagSrc={flags?.away} size={46} />
          <div style={{ display: "flex", fontSize: 46, fontWeight: 700, color: "#fff", marginLeft: 14 }}>{d.awayLabel}</div>
        </div>
      </div>

      {/* 라인별 행 */}
      <div style={{ display: "flex", flexDirection: "column", marginTop: 44 }}>
        {lanes.map((l) => (
          <div key={l.code} style={{ display: "flex", alignItems: "center", marginBottom: 26 }}>
            <div style={{ display: "flex", flex: 1, justifyContent: "flex-end", fontSize: 34, color: "#fff", paddingRight: 22 }}>
              {l.home?.name ?? "-"}
            </div>
            {scoreBox(l.home?.avg ?? null, "#e23744")}
            <div style={{ display: "flex", width: 96, justifyContent: "center", fontSize: 20, fontWeight: 700, color: "#8a92ad" }}>
              {l.short}
            </div>
            {scoreBox(l.away?.avg ?? null, "#2f6bd8")}
            <div style={{ display: "flex", flex: 1, justifyContent: "flex-start", fontSize: 34, color: "#fff", paddingLeft: 22 }}>
              {l.away?.name ?? "-"}
            </div>
          </div>
        ))}
      </div>

      {/* 푸터 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: `1px solid #1c2438`,
          paddingTop: 20,
          marginTop: "auto",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: "#5b9bf0" }}>fanarena.kr</div>
        <div style={{ display: "flex", fontSize: 22, color: "#6f7790" }}>팬이 직접 매긴 평점</div>
      </div>
    </div>
  );
}

// ─────────────────────────── 세로형 (1080 × 1320) BEST vs WORST ───────────────────────────
export function PortraitCard({ data: d, flags }: { data: ShareCardData; flags?: Flags }) {
  const homeColor = teamColor(d.homeTeam, undefined, DEFAULT_HOME);
  const awayColor = teamColor(d.awayTeam, undefined, DEFAULT_AWAY);

  const teamBox = (
    teamKey: string,
    label: string,
    flagSrc: string | null | undefined,
    pick: CardPick | null,
    accent: string,
  ) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        border: `3px solid ${accent}`,
        background: "#141a2b",
        borderRadius: 20,
        padding: "24px 30px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <TeamMark teamKey={teamKey} flagSrc={flagSrc} size={40} />
        <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: "#fff", marginLeft: 14 }}>{label}</div>
        <div style={{ display: "flex", marginLeft: "auto", fontSize: 18, color: MUTED }}>최고 평점</div>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 16 }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 58, fontWeight: 700, color: "#fff" }}>{pick ? pick.name : "-"}</div>
          <div style={{ display: "flex", fontSize: 24, color: SUBTLE, marginTop: 8 }}>{pick ? pickTag(pick) : ""}</div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <div style={{ display: "flex", fontSize: 84, fontWeight: 700, color: GOLD }}>{pick ? fmt(pick.avg) : "-"}</div>
          <div style={{ display: "flex", fontSize: 24, color: SUBTLE, paddingBottom: 14, marginLeft: 6 }}>/ 10</div>
        </div>
      </div>
    </div>
  );

  const pill = (text: string) => (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div
        style={{
          display: "flex",
          background: "#2a3550",
          color: "#cfd6e6",
          fontSize: 24,
          fontWeight: 700,
          padding: "10px 24px",
          borderRadius: 999,
        }}
      >
        {text}
      </div>
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
        color: "#e9edf6",
        fontFamily: "Pretendard",
        padding: "56px 60px",
      }}
    >
      {/* 헤더 */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: "#9aa3ba", letterSpacing: 3 }}>
          FAN RATINGS · 팬 평점
        </div>
        <div style={{ display: "flex", width: 90, height: 3, background: "#46527a", marginTop: 14 }} />
      </div>

      {/* 스코어 + 대회 */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 30 }}>
        <div style={{ display: "flex", fontSize: 44, fontWeight: 700, color: "#fff" }}>
          {d.homeLabel} {d.scoreLabel} {d.awayLabel}
        </div>
        <div style={{ display: "flex", fontSize: 24, color: MUTED, marginTop: 12 }}>
          {d.competition} · {d.dateText}
        </div>
      </div>

      {/* 타이틀 */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 26 }}>
        <div style={{ display: "flex", fontSize: 32, fontWeight: 700, color: GOLD }}>팀별 최고 평점</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", marginTop: 28 }}>
        {teamBox(d.homeTeam, d.homeLabel, flags?.home, d.homeBest, homeColor)}
        <div style={{ display: "flex", justifyContent: "center", padding: "14px 0" }}>
          <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: "#5a6480" }}>VS</div>
        </div>
        {teamBox(d.awayTeam, d.awayLabel, flags?.away, d.awayBest, awayColor)}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 22 }}>
          {pill(
            d.homeAvg != null && d.awayAvg != null
              ? `팀 평균   ${d.homeLabel} ${fmt(d.homeAvg)}   ·   ${d.awayLabel} ${fmt(d.awayAvg)}`
              : "팀 평균 -",
          )}
        </div>
      </div>

      {/* 푸터 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: `1px solid #1e2740`,
          paddingTop: 20,
          marginTop: "auto",
        }}
      >
        <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: "#5b9bf0" }}>fanarena.kr</div>
        <div style={{ display: "flex", fontSize: 22, color: MUTED }}>팬이 직접 매긴 평점</div>
      </div>
    </div>
  );
}
