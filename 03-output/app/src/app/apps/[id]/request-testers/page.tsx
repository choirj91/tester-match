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

  // 오늘(24h 롤링) 발송 건수
  const DAILY_LIMIT = 30;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: todayCount } = await supabase
    .from("tester_request_sends")
    .select("id", { count: "exact", head: true })
    .eq("sender_user_id", user.id)
    .gte("sent_at", since);

  const remaining = Math.max(0, DAILY_LIMIT - (todayCount ?? 0));

  // 이미 이 앱으로 요청 보낸 수신자 ID
  const { data: alreadySent } = await supabase
    .from("tester_request_sends")
    .select("recipient_user_id")
    .eq("sender_user_id", user.id)
    .eq("app_id", appId);
  const alreadySentIds = (alreadySent ?? []).map((r) => r.recipient_user_id);

  // 이미 매칭된 테스터 ID
  const { data: matched } = await supabase
    .from("matches")
    .select("tester_user_id")
    .eq("app_id", appId)
    .in("status", ["pending", "active", "completed"]);
  const matchedIds = (matched ?? []).map((m) => m.tester_user_id);

  // 제외 ID 목록
  const excludeIds = Array.from(new Set([user.id, ...alreadySentIds, ...matchedIds]));

  // 후보자 조회 (최근 가입 순)
  type CandidateRow = { id: number; nickname: string; trust_score: number; created_at: string };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from("users")
    .select("id, nickname, trust_score, created_at")
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
          <h1 className="text-2xl font-bold text-neutral-900">테스터 요청 보내기</h1>
          <p className="mt-1 text-sm text-neutral-600">
            <span className="font-medium">{app.name}</span> · Tester Match 회원들에게 직접 이메일로 테스트 참여를 요청합니다.
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
              created_at: c.created_at,
            }))}
            todayCount={todayCount ?? 0}
            dailyLimit={DAILY_LIMIT}
            remaining={remaining}
          />
        </div>
      </main>
    </>
  );
}
