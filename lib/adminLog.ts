import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { prisma } from "./prisma";

// 관리자 조치를 감사 로그에 기록. 실패해도 본 작업을 막지 않도록 try/catch.
// 세션을 직접 조회하므로 호출부는 한 줄이면 됨: await logAdmin("DELETE_MATCH", "Match", id, detail)
export async function logAdmin(
  action: string,
  targetType: string,
  targetId?: string | null,
  detail = ""
) {
  try {
    const session = await getServerSession(authOptions);
    const adminId = (session?.user as any)?.id as string | undefined;
    if (!adminId) return;
    await prisma.adminLog.create({
      data: {
        adminId,
        adminName: (session!.user?.name as string) || "관리자",
        action,
        targetType,
        targetId: targetId ?? null,
        detail: (detail || "").slice(0, 300),
      },
    });
  } catch (e) {
    console.error("[adminLog]", e);
  }
}
