import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";

export const runtime = 'edge';

export const metadata = { title: "급구 (준비중)" };

export default async function BoostPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login?next=/boost");

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-6 py-20 text-center">
        <span className="rounded-full bg-spark-50 px-3 py-1 text-xs font-bold text-spark-600">
          서비스 준비중
        </span>
        <h1 className="mt-6 text-3xl font-bold text-neutral-900">급구 — Boost SLA</h1>
        <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-neutral-600">
          24시간 / 48시간 안에 12명 매칭을 보장하는 유료 우선노출 서비스. <br />
          베타 종료 후 정식 출시 예정입니다.
        </p>

        <div className="mt-10 grid w-full gap-4 sm:grid-cols-2">
          <PlanCard sla="24시간" price="49,000원" tone="trust" />
          <PlanCard sla="48시간" price="29,000원" tone="neutral" />
        </div>

        <p className="mt-10 text-sm text-neutral-500">
          출시 알림은 베타 사용자에게 우선 발송됩니다.
        </p>
        <Link
          href="/apps"
          className="mt-4 text-sm font-medium text-trust-600 hover:text-trust-700"
        >
          내 앱으로 돌아가기 →
        </Link>
      </main>
    </>
  );
}

function PlanCard({ sla, price, tone }: { sla: string; price: string; tone: "trust" | "neutral" }) {
  const isHero = tone === "trust";
  return (
    <div
      className={`rounded-2xl border p-6 text-left shadow-sm ${
        isHero ? "border-trust-600 bg-trust-50" : "border-neutral-200 bg-white"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
        SLA {sla}
      </p>
      <p className={`mt-2 text-2xl font-bold tabular ${isHero ? "text-trust-600" : "text-neutral-900"}`}>
        {price}
      </p>
      <ul className="mt-4 space-y-1.5 text-sm text-neutral-700">
        <li>• 매칭 큐 최상위 노출</li>
        <li>• 미달성 시 비례 환불</li>
        <li>• 전용 알림 채널</li>
      </ul>
    </div>
  );
}
