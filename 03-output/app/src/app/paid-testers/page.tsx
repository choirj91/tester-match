import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  PAID_ORDER_STATUS_LABEL,
  PAID_TESTER_PRICE_KRW,
  type PaidOrderStatus,
} from "@/lib/paid-testers";
import { formatKrw } from "@/lib/credits";
import { OrderForm } from "./order-form";

export const runtime = "edge";
export const metadata = {
  alternates: { canonical: "/paid-testers" },
  title: "유료 테스터",
  description:
    "Google Play 비공개 테스트 12명이 부족할 때 — 운영팀 테스터가 1명당 1,000원에 14일간 실기기로 매일 체크인합니다.",
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
  { title: "인원 선택·결제", desc: "부족한 인원만큼 1~10명을 선택해 결제합니다. 1명 = 1,000원." },
  { title: "운영팀 테스터 참여", desc: "결제 확인 즉시 운영팀이 실제 기기에서 앱을 설치하고 테스트를 시작합니다." },
  { title: "14일 매일 체크인", desc: "매일 앱을 실행하고 체크인을 남깁니다. 앱 상세의 테스터 모니터링에서 실시간 확인." },
  { title: "완주", desc: "14일을 채우면 프로덕션 액세스 신청 요건의 인원으로 카운트됩니다." },
];

const GUARANTEES = [
  "실제 안드로이드 기기에서 실사용 — 봇·에뮬레이터를 쓰지 않습니다",
  "리뷰·별점은 절대 남기지 않습니다 (Google Play 정책 준수)",
  "테스트 개시 전에는 전액 환불",
  "동시 진행 물량 제한 — 품질을 지킬 수 있는 만큼만 판매",
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
        <p className="text-xs font-semibold text-trust-600">PAID TESTERS</p>
        <h1 className="mt-1 text-3xl font-bold text-neutral-900">
          테스터가 부족할 때, 확실한 {formatKrw(PAID_TESTER_PRICE_KRW)}원
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          품앗이로 못 채운 인원을 운영팀 테스터가 채웁니다. 1명당{" "}
          {formatKrw(PAID_TESTER_PRICE_KRW)}원, 14일간 매일 실기기 체크인.
        </p>

        <section className="mt-10">
          <h2 className="text-lg font-bold text-neutral-900">진행 방식</h2>
          <ol className="mt-4 space-y-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-3 rounded-xl border border-neutral-200 bg-white p-4">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-trust-600 text-xs font-bold text-white">
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

        <section className="mt-8 rounded-2xl border border-trust-500/30 bg-trust-50 p-5">
          <h2 className="text-sm font-bold text-neutral-900">약속</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-neutral-700">
            {GUARANTEES.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-bold text-neutral-900">신청하기</h2>
          {!user ? (
            <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-6 text-center">
              <p className="text-sm text-neutral-600">로그인 후 신청할 수 있습니다.</p>
              <Link
                href="/auth/login?next=/paid-testers"
                className="mt-3 inline-block rounded-lg bg-trust-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-trust-700"
              >
                로그인
              </Link>
            </div>
          ) : apps.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-6 text-center">
              <p className="text-sm text-neutral-600">
                먼저 앱을 등록해주세요. 등록한 앱에만 테스터를 투입할 수 있습니다.
              </p>
              <Link
                href="/apps/new"
                className="mt-3 inline-block rounded-lg bg-trust-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-trust-700"
              >
                앱 등록하기
              </Link>
            </div>
          ) : (
            <OrderForm apps={apps} />
          )}
        </section>

        {orders.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-bold text-neutral-900">내 주문</h2>
            <ul className="mt-4 space-y-2">
              {orders.map((o) => (
                <li
                  key={o.id}
                  className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-semibold text-neutral-900">
                      {o.apps?.name ?? "삭제된 앱"} — {o.tester_count}명
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {new Date(o.created_at).toLocaleDateString("ko-KR")} ·{" "}
                      {formatKrw(o.amount_krw)}원 · {o.order_code}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
                    {PAID_ORDER_STATUS_LABEL[o.status] ?? o.status}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-10 text-xs leading-relaxed text-neutral-400">
          유료 테스터는 실사용 기반으로 진행되며, 리뷰·평점 작성이나 인위적 참여는 제공하지
          않습니다. 환불 기준은{" "}
          <Link href="/policies/refund" className="underline underline-offset-2">
            환불 정책
          </Link>
          을 따릅니다.
        </p>
      </main>
    </>
  );
}
