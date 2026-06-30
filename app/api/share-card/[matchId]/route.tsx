import { ImageResponse } from "next/og";
import { getShareCardData } from "@/lib/shareCardServer";
import { LandscapeCard, PortraitCard, PortraitLckCard, loadShareFonts, CARD_BG, type Flags } from "@/lib/shareCardImage";
import { flagCode, flagUrl } from "@/lib/teamFlags";

// 경기별 공유 카드 PNG.  ?v=portrait → 세로(인스타), 기본 → 가로(링크 언펄)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 국대 국기를 미리 받아 data URI로. 실패하면 null(국기만 생략, 카드는 정상).
async function flagDataUri(team: string): Promise<string | null> {
  const code = flagCode(team);
  if (!code) return null;
  try {
    const res = await fetch(flagUrl(code), { cache: "force-cache" });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(req: Request, { params }: { params: { matchId: string } }) {
  const { searchParams } = new URL(req.url);
  const portrait = searchParams.get("v") === "portrait";
  const team = searchParams.get("team") === "away" ? "away" : "home";
  const size = portrait ? { width: 1080, height: 1320 } : { width: 1200, height: 630 };

  try {
    const data = await getShareCardData(params.matchId);
    if (!data) {
      return new ImageResponse(
        (<div style={{ display: "flex", width: "100%", height: "100%", background: CARD_BG }} />),
        size,
      );
    }

    const [homeFlag, awayFlag] = await Promise.all([flagDataUri(data.homeTeam), flagDataUri(data.awayTeam)]);
    const flags: Flags = { home: homeFlag, away: awayFlag, focus: homeFlag };

    const element = portrait
      ? data.sport === "lck"
        ? <PortraitLckCard data={data} flags={flags} />
        : <PortraitCard data={data} team={team} flags={flags} />
      : <LandscapeCard data={data} flags={flags} />;

    return new ImageResponse(element, {
      ...size,
      fonts: loadShareFonts(),
      headers: { "cache-control": "public, max-age=300, s-maxage=300" },
    });
  } catch (e) {
    // 렌더 실패 시 링크 썸네일이 깨지지 않도록 기본 OG 이미지로 폴백
    return Response.redirect("https://fanarena.kr/og.png", 302);
  }
}
