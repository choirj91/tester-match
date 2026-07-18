import Link from "next/link";

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
    <section className="mx-auto mt-8 max-w-4xl px-6">
      <div className="rounded-2xl border border-trust-500/30 bg-gradient-to-br from-trust-50 to-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-neutral-900">시작하기</h2>
            <p className="mt-0.5 text-sm text-neutral-600">
              4단계로 첫 매칭까지. 지금 {doneCount}/{items.length} 완료
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-40 overflow-hidden rounded-full bg-neutral-200">
              <div
                className="h-full rounded-full bg-trust-600 transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="tabular text-sm font-semibold text-trust-700">{percent}%</span>
          </div>
        </div>

        <ol className="mt-5 grid gap-3 sm:grid-cols-2">
          {items.map((it, i) => {
            const done = steps[it.key];
            return (
              <li key={it.key}>
                <Link
                  href={it.href}
                  className={`flex items-start gap-3 rounded-xl border p-4 transition ${
                    done
                      ? "border-mint-500/40 bg-mint-500/5"
                      : "border-neutral-200 bg-white hover:border-trust-500 hover:shadow-md"
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      done
                        ? "bg-mint-500 text-white"
                        : "bg-neutral-200 text-neutral-500"
                    }`}
                  >
                    {done ? "✓" : i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-semibold ${
                        done ? "text-neutral-500 line-through" : "text-neutral-900"
                      }`}
                    >
                      {it.label}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-500">{it.hint}</p>
                  </div>
                  {!done && (
                    <span className="shrink-0 text-xs font-semibold text-trust-600">
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
