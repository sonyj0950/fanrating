import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import AdminForm from "./AdminForm";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") redirect("/");

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">⚙️ 경기 등록</h1>
      <AdminForm />
      <p className="text-xs text-gray-500 mt-3">
        ※ 경기 삭제는 홈 화면 또는 각 경기 페이지의 🗑 버튼으로 할 수 있습니다.
        골·어시스트 기록은 경기 페이지에서 입력합니다.
      </p>
    </div>
  );
}
