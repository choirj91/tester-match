import Link from "next/link";
import { Check } from "lucide-react";

export type OnboardingSteps = {
  signedUp: boolean;
  hasApp: boolean;
  hasMatch: boolean;
};

/**
 * 온보딩 진행률 카드 — 로그인 이후 첫 매칭까지 3단계 유도.
 * 모두 완료 시 렌더하지 않음.
 */
export function OnboardingProgress({ steps }: { steps: OnboardingSteps }) {
  const allDone = steps.signedUp && steps.hasApp && steps.hasMatch;
  if (allDone) return null;

  const items: {
    key: keyof OnboardingSteps;
    label: string;
    hint: string;
    href: string;
    cta: string;
  }[] = [
    {
      key: "signedUp",
      label: "회원가입",
      hint: "Google 계정 연동 완료",
      href: "/profile",
      cta: "프로필",
    },
    {
      key: "hasApp",
      label: "첫 앱 등록",
      hint: "테스터를 모집할 앱 정보 입력 (Play Store URL 자동 채움 지원)",
      href: "/apps/new",
      cta: "앱 등록하기",
    },
    {
      key: "hasMatch",
      label: "첫 매칭 참여",
      hint: "다른 개발자 앱을 테스트하며 품앗이 시작",
      href: "/browse",
      cta: "매칭 가능 앱",
    },
  ];

  const doneCount = items.filter((it) => steps[it.key]).length;
  const percent = Math.round((doneCount / items.length) * 100);

  return (
    <section className="mx-auto max-w-[1200px] px-5 pt-8">
      <div className="border border-ink-900 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-ink-900">시작하기</h2>
            <p className="mt-0.5 text-sm text-ink-700">
              4단계로 첫 매칭까지. 지금 {doneCount}/{items.length} 완료
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-40 overflow-hidden bg-ink-200">
              <div
                className="h-full bg-ink-900 transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="tabular text-sm font-semibold text-ink-900">{percent}%</span>
          </div>
        </div>

        <ol className="mt-5 grid gap-3 sm:grid-cols-2">
          {items.map((it, i) => {
            const done = steps[it.key];
            return (
              <li key={it.key}>
                <Link
                  href={it.href}
                  className={`flex items-start gap-3  border p-4 transition ${
                    done
                      ? "border-success-700 bg-success-50"
                      : "border-ink-200 bg-white hover:border-ink-900 "
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center  text-sm font-bold ${
                      done
                        ? "bg-success-700 text-white"
                        : "bg-ink-200 text-ink-600"
                    }`}
                  >
                    {done ? <Check className="h-4 w-4" aria-label="완료" /> : i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-semibold ${
                        done ? "text-ink-600 line-through" : "text-ink-900"
                      }`}
                    >
                      {it.label}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-600">{it.hint}</p>
                  </div>
                  {!done && (
                    <span className="shrink-0 text-xs font-semibold text-ink-900">
                      {it.cta} →
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
