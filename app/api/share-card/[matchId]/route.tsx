import { ImageResponse } from "next/og";
import { getShareCardData } from "@/lib/shareCardServer";
import { LandscapeCard, PortraitCard, PortraitLckCard, loadShareFonts, CARD_BG } from "@/lib/shareCardImage";

// 경기별 공유 카드 PNG.  ?v=portrait → 세로(인스타), 기본 → 가로(링크 언펄)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { matchId: string } }) {
  const { searchParams } = new URL(req.url);
  const portrait = searchParams.get("v") === "portrait";
  const size = portrait ? { width: 1080, height: 1320 } : { width: 1200, height: 630 };

  try {
    const data = await getShareCardData(params.matchId);
    if (!data) {
      return new ImageResponse(
        (<div style={{ display: "flex", width: "100%", height: "100%", background: CARD_BG }} />),
        size,
      );
    }

    const element = portrait
      ? data.sport === "lck"
        ? <PortraitLckCard data={data} />
        : <PortraitCard data={data} />
      : <LandscapeCard data={data} />;

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
