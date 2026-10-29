import Link from "next/link";
import { redirect } from "next/navigation";
import { WithdrawButton } from "@/app/profile/withdraw-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/form";
import { getCurrentUser } from "@/lib/auth";
import { consentNextPath } from "@/lib/consent-gate";
import { SITE_URL } from "@/lib/site";
import { effectiveVersion, koreanDate, type PolicyKind } from "@/policies/registry";
import { AuthCard, FormError } from "../auth-card";

export const metadata = {
  title: "약관 동의",
  robots: { index: false, follow: false },
};

const POLICY = {
  terms: { title: "이용약관", href: "/policies/terms" },
  privacy: { title: "개인정보처리방침", href: "/policies/privacy" },
} as const;

const ERROR_MESSAGE = {
  agree: "내용을 확인하고 동의 칸에 체크해주세요.",
  save: "동의를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.",
} as const;

const LINK = "font-semibold text-ink-900 underline underline-offset-2 hover:text-accent-600";

/** 시행 중인 약관에 동의하지 않은 회원이 서비스 화면 대신 보는 화면 (lib/auth 가 이리로 보낸다) */
export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const nextPath = consentNextPath(next, SITE_URL);
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  const pending = user.pendingPolicies ?? [];
  if (pending.length === 0) redirect(nextPath);

  const now = new Date();
  const items = pending.flatMap((kind: PolicyKind) => {
    const version = effectiveVersion(kind, now);
    return version ? [{ kind, version }] : [];
  });
  const errorText = error === "agree" || error === "save" ? ERROR_MESSAGE[error] : null;

  return (
    <AuthCard title="약관 동의">
      <p className="text-ink-700 m-0 mt-2 text-sm leading-relaxed">
        서비스를 계속 이용하려면 아래 약관에 동의해주세요.
      </p>

      <ul className="m-0 mt-6 flex list-none flex-col gap-4 p-0">
        {items.map(({ kind, version }) => (
          <li key={kind} className="border-ink-900 border p-4">
            <p className="text-ink-900 m-0 text-[15px] font-bold">
              {POLICY[kind].title}{" "}
              <span className="text-ink-600 font-mono text-xs font-medium">
                {koreanDate(version.version)} 시행
              </span>
            </p>
            {version.changes.length > 0 && (
              <ul className="text-ink-700 m-0 mt-2 list-disc space-y-1 pl-5 text-[13px] leading-relaxed">
                {version.changes.map((change) => (
                  <li key={change}>{change}</li>
                ))}
              </ul>
            )}
            <Link
              href={POLICY[kind].href}
              target="_blank"
              rel="noopener noreferrer"
              className={`mt-3 inline-flex min-h-11 items-center text-sm ${LINK}`}
            >
              전문 보기
            </Link>
          </li>
        ))}
      </ul>

      <form method="post" action="/api/auth/consent" className="mt-6 flex flex-col gap-4">
        <input type="hidden" name="next" value={nextPath} />
        <Checkbox
          name="agreed"
          required
          className="text-ink-700 text-sm leading-relaxed"
          label="위 약관의 내용을 확인했고 동의합니다."
        />
        {errorText && <FormError>{errorText}</FormError>}
        <Button type="submit" className="w-full">
          동의하고 계속하기
        </Button>
      </form>

      <div className="border-ink-200 text-ink-600 mt-8 border-t pt-4 text-xs leading-relaxed">
        <p className="m-0">
          동의하지 않으면 서비스를 이용할 수 없습니다. 로그아웃하거나 탈퇴할 수 있습니다.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <form method="post" action="/auth/signout">
            <Button type="submit" variant="secondary">
              로그아웃
            </Button>
          </form>
          <WithdrawButton />
        </div>
      </div>
    </AuthCard>
  );
}
