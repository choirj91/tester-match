import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  PAID_ORDER_STATUS_LABEL,
  PAID_TESTERS_PUBLIC_ORDERING,
  PAID_TESTER_PRICE_KRW,
  canOrderPaidTesters,
  type PaidOrderStatus,
} from "@/lib/paid-testers";
import { formatKrw } from "@/lib/credits";
import { OrderForm } from "./order-form";

export const runtime = "edge";
export const metadata = {
  alternates: { canonical: "/paid-testers" },
  title: "유료 테스터",
  description:
    "Google Play 비공개 테스트 12명이 부족할 때 — 검증된 커뮤니티 테스터가 1명당 1,000원에 14일간 실기기로 매일 스크린샷 체크인합니다.",
};

type OrderRow = {
  id: number;
  order_code: string;
  tester_count: number;
  amount_krw: number;
  status: PaidOrderStatus;
  created_at: string;
  apps: { name: string } | null;
};

const STEPS = [
  { title: "인원 선택·결제", desc: "부족한 인원만큼 1~10명(시트)을 선택해 결제합니다. 1명 = 1,000원. 보유 크레딧으로도 결제 가능." },
  {
    title: "급구 노출 + 전 회원 알림",
    desc: "결제 즉시 매칭 목록 상단 급구에 노출되고 전 회원에게 알림이 갑니다. 검증된 커뮤니티 테스터가 시트를 선착순으로 채웁니다.",
  },
  {
    title: "14일 매일 체크인 + 스크린샷",
    desc: "시트 테스터는 매일 앱을 실행하고 스크린샷 1장과 함께 체크인합니다. 콘솔에서 테스터별 증빙을 날짜별로 확인.",
  },
  { title: "완주", desc: "14일을 채우면 프로덕션 액세스 신청 요건의 인원으로 카운트됩니다. 테스터는 700 크레딧을 받습니다." },
];

const GUARANTEES = [
  "실제 안드로이드 기기를 쓰는 실사용자 — 봇·에뮬레이터·계정 농장 없음",
  "리뷰·별점은 절대 유도하지 않습니다 (위반 시 테스터 보상 몰수, Google Play 정책 준수)",
  "매일 스크린샷 증빙 — 완주해야 보상이 지급되므로 중도 이탈 유인이 낮음",
  "7일 내 시트가 안 채워지면 해당 인원 전액 환불",
];

export default async function PaidTestersPage() {
  const user = await getCurrentUser();

  let apps: Array<{ id: number; name: string }> = [];
  let orders: OrderRow[] = [];
  if (user) {
    const supabase = createSupabaseAdminClient();
    const [appsRes, ordersRes] = await Promise.all([
      supabase
        .from("apps")
        .select("id, name")
        .eq("owner_user_id", user.id)
        .neq("status", "deleted")
        .order("created_at", { ascending: false }),
      supabase
        .from("paid_tester_orders")
        .select("id, order_code, tester_count, amount_krw, status, created_at, apps(name)")
        .eq("buyer_user_id", user.id)
        .neq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    apps = appsRes.data ?? [];
    orders = (ordersRes.data ?? []) as unknown as OrderRow[];
  }

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-trust-600 text-xs font-semibold">PAID TESTERS</p>
        <h1 className="mt-1 text-3xl font-bold text-neutral-900">
          테스터가 부족할 때, 확실한 {formatKrw(PAID_TESTER_PRICE_KRW)}원
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          품앗이로 못 채운 인원을 검증된 커뮤니티 테스터가 채웁니다. 1명당 {formatKrw(PAID_TESTER_PRICE_KRW)}
          원, 14일간 매일 실기기 체크인.
        </p>

        <section className="mt-10">
          <h2 className="text-lg font-bold text-neutral-900">진행 방식</h2>
          <ol className="mt-4 space-y-3">
            {STEPS.map((s, i) => (
              <li
                key={s.title}
                className="flex gap-3 rounded-xl border border-neutral-200 bg-white p-4"
              >
                <span className="bg-trust-600 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{s.title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-neutral-600">{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-trust-500/30 bg-trust-50 mt-8 rounded-2xl border p-5">
          <h2 className="text-sm font-bold text-neutral-900">약속</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-neutral-700">
            {GUARANTEES.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-bold text-neutral-900">신청하기</h2>
          {!user && PAID_TESTERS_PUBLIC_ORDERING ? (
            <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-6 text-center">
              <p className="text-sm text-neutral-600">로그인 후 신청할 수 있습니다.</p>
              <Link
                href="/auth/login?next=/paid-testers"
                className="bg-trust-600 hover:bg-trust-700 mt-3 inline-block rounded-lg px-5 py-2.5 text-sm font-semibold text-white"
              >
                로그인
              </Link>
            </div>
          ) : !canOrderPaidTesters(user) ? (
            <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-6 text-center">
              <p className="text-sm font-semibold text-amber-900">곧 오픈합니다</p>
              <p className="mt-1 text-sm leading-relaxed text-amber-800">
                결제 연동 마무리 중입니다. 오픈 시 게시판 공지로 안내드릴게요.
              </p>
            </div>
          ) : apps.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-6 text-center">
              <p className="text-sm text-neutral-600">
                먼저 앱을 등록해주세요. 등록한 앱에만 테스터를 투입할 수 있습니다.
              </p>
              <Link
                href="/apps/new"
                className="bg-trust-600 hover:bg-trust-700 mt-3 inline-block rounded-lg px-5 py-2.5 text-sm font-semibold text-white"
              >
                앱 등록하기
              </Link>
            </div>
          ) : (
            <OrderForm apps={apps} balance={user?.balance ?? 0} />
          )}
        </section>

        {orders.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-bold text-neutral-900">내 주문</h2>
            <ul className="mt-4 space-y-2">
              {orders.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/console/orders/${o.id}`}
                    className="hover:border-trust-500 flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm transition"
                  >
                    <div>
                      <p className="font-semibold text-neutral-900">
                        {o.apps?.name ?? "삭제된 앱"} — {o.tester_count}명
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {new Date(o.created_at).toLocaleDateString("ko-KR")} ·{" "}
                        {formatKrw(o.amount_krw)}원 · {o.order_code} · 출석표·스크린샷 보기 →
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
                      {PAID_ORDER_STATUS_LABEL[o.status] ?? o.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-10 text-xs leading-relaxed text-neutral-400">
          유료 테스터는 커뮤니티 실사용자가 참여하며(완주 시 700 크레딧), 리뷰·평점 작성이나 인위적 참여는
          제공하지 않습니다. 환불 기준은{" "}
          <Link href="/policies/refund" className="underline underline-offset-2">
            환불 정책
          </Link>
          을 따릅니다.
        </p>
      </main>
    </>
  );
}
