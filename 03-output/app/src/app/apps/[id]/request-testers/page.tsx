import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { RequestForm } from "./request-form";

export const runtime = "edge";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  return { title: `테스터 요청 — 앱 #${id}` };
}

export default async function RequestTestersPage({ params }: Props) {
  const user = await getCurrentUser();
  if (!user) {
    const { id } = await params;
    redirect(`/auth/login?next=/apps/${id}/request-testers`);
  }

  const { id } = await params;
  const appId = Number(id);
  if (!Number.isInteger(appId)) notFound();

  const supabase = createSupabaseAdminClient();

  // 본인 앱 확인
  const { data: app } = await supabase
    .from("apps")
    .select("id, name, short_description, owner_user_id")
    .eq("id", appId)
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (!app) notFound();

  // 이미 매칭된 테스터 ID (제외 대상)
  const { data: matched } = await supabase
    .from("matches")
    .select("tester_user_id")
    .eq("app_id", appId)
    .in("status", ["pending", "active", "completed"]);
  const matchedIds = (matched ?? []).map((m) => m.tester_user_id);

  // 제외 ID (본인 + 이미 매칭)
  const excludeIds = Array.from(new Set([user.id, ...matchedIds]));

  // 후보자 조회 (최근 가입 순, 이메일 포함)
  type CandidateRow = {
    id: number;
    nickname: string;
    trust_score: number;
    email: string;
    created_at: string;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from("users")
    .select("id, nickname, trust_score, email, created_at")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(200);

  if (excludeIds.length > 0) {
    query = query.not("id", "in", `(${excludeIds.join(",")})`);
  }

  const { data: candidates } = (await query) as { data: CandidateRow[] | null };

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <Link href={`/apps/${appId}`} className="text-sm text-neutral-500 hover:text-neutral-900">
          ← {app.name}
        </Link>

        <div className="mt-4">
          <h1 className="text-2xl font-bold text-neutral-900">테스터 요청하기</h1>
          <p className="mt-1 text-sm text-neutral-600">
            <span className="font-medium">{app.name}</span> · 이메일 주소를 복사하거나 Gmail로 바로 열어 테스트 참여 요청을 보낼 수 있습니다.
          </p>
        </div>

        <div className="mt-8">
          <RequestForm
            appId={app.id}
            appName={app.name}
            senderNickname={user.nickname}
            shortDescription={app.short_description}
            candidates={(candidates ?? []).map((c) => ({
              id: c.id,
              nickname: c.nickname,
              trust_score: c.trust_score,
              email: c.email,
            }))}
          />
        </div>
      </main>
    </>
  );
}
