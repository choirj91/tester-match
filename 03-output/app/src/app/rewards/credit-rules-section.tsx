import Link from "next/link";
import { CREDIT_RULES } from "@/lib/rewards";

/**
 * 크레딧 규칙 4줄 — 보상·크레딧 화면에 항상 펼쳐 둔다.
 * 페이지의 반전 섹션(먹색 면)은 이것 하나뿐이어야 한다.
 */
export function CreditRulesSection() {
  return (
    <section aria-labelledby="credit-rules-title" className="bg-surface-ink text-white">
      <div className="mx-auto grid max-w-[1200px] grid-cols-[repeat(auto-fit,minmax(min(380px,100%),1fr))] items-start gap-7 px-5 py-11">
        <div className="flex flex-col gap-2">
          <h2
            id="credit-rules-title"
            className="font-display text-h2 m-0 font-semibold tracking-[-0.01em]"
          >
            크레딧 규칙
          </h2>
          <p className="text-ink-300 m-0 text-[15px]">
            자세한 기준은{" "}
            <Link
              href="/policies/credits"
              className="hover:text-ink-300 text-white underline underline-offset-2"
            >
              크레딧 운영 정책
            </Link>
            을 따릅니다.
          </p>
        </div>
        <ol className="m-0 flex list-none flex-col p-0 text-sm leading-relaxed">
          {CREDIT_RULES.map((rule, i) => (
            <li key={rule} className="border-ink-700 flex gap-3 border-b py-3 first:pt-0">
              <span className="text-ink-300 font-mono text-xs tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>{rule}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
