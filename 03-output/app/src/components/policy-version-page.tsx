import Link from "next/link";
import { notFound } from "next/navigation";
import { PolicyLayout } from "@/components/policy-layout";
import { Notice } from "@/components/ui/notice";
import type { AppUser } from "@/lib/auth";
import { policyBody } from "@/policies/bodies";
import {
  effectiveVersion,
  findVersion,
  koreanDate,
  upcomingVersion,
  versionsOf,
  type PolicyKind,
  type PolicyVersion,
} from "@/policies/registry";

const META = {
  terms: { title: "이용약관", href: "/policies/terms" },
  privacy: { title: "개인정보처리방침", href: "/policies/privacy" },
} as const;

const LINK = "text-ink-900 underline underline-offset-2 hover:text-accent-600";

function versionHref(kind: PolicyKind, version: string) {
  return `${META[kind].href}?version=${version}`;
}

function ChangeList({ version }: { version: PolicyVersion }) {
  if (version.changes.length === 0) return null;
  return (
    <ul className="m-0 mt-2 list-disc space-y-1 pl-5">
      {version.changes.map((change) => (
        <li key={change}>{change}</li>
      ))}
    </ul>
  );
}

/**
 * 약관 화면 — 기본은 지금 시행 중인 버전, ?version= 이면 그 버전(이전판·개정 예정판).
 * 개정 예정판이 있으면 제목 아래에 시행일과 바뀌는 점을 알린다 (약관 제3조).
 */
export function PolicyVersionPage({
  kind,
  user,
  requested,
}: {
  kind: PolicyKind;
  user: AppUser | null;
  requested?: string;
}) {
  const now = new Date();
  const current = effectiveVersion(kind, now);
  const shown = (requested ? findVersion(kind, requested) : undefined) ?? current;
  const body = shown ? policyBody(kind, shown.version) : undefined;
  if (!current || !shown || body === undefined) notFound();

  const upcoming = upcomingVersion(kind, now);
  const { title, href } = META[kind];
  const others = versionsOf(kind).filter((v) => v.version !== shown.version);

  let notice = null;
  if (shown.version !== current.version) {
    const isUpcoming = Date.parse(shown.effectiveAt) > now.getTime();
    notice = (
      <Notice
        kind="caution"
        title={
          isUpcoming
            ? `${koreanDate(shown.version)} 시행 예정인 개정안입니다`
            : "지금 시행 중인 판이 아닙니다"
        }
      >
        {isUpcoming && <ChangeList version={shown} />}
        <p className="m-0 mt-2">
          <Link href={href} className={LINK}>
            현재 시행 중인 {title} ({koreanDate(current.version)} 시행) 보기
          </Link>
        </p>
      </Notice>
    );
  } else if (upcoming) {
    notice = (
      <Notice
        kind="caution"
        title={`개정 ${title}이 ${koreanDate(upcoming.version)}부터 시행됩니다`}
      >
        <ChangeList version={upcoming} />
        <p className="m-0 mt-2">
          <Link href={versionHref(kind, upcoming.version)} className={LINK}>
            개정 {title} 전문 보기
          </Link>
          {" · "}시행일 이후에는 로그인할 때 개정 {title}에 동의를 받습니다.
        </p>
      </Notice>
    );
  }

  return (
    <PolicyLayout
      user={user}
      active={href}
      title={title}
      effectiveDate={koreanDate(shown.version)}
      notice={notice}
    >
      {body}
      {others.length > 0 && (
        <>
          <h3>다른 버전</h3>
          <ul>
            {others.map((v) => (
              <li key={v.version}>
                <Link href={v.version === current.version ? href : versionHref(kind, v.version)}>
                  {koreanDate(v.version)} 시행
                  {Date.parse(v.effectiveAt) > now.getTime() ? " (예정)" : ""}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </PolicyLayout>
  );
}
