import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { requireAdminUser } from "@/lib/admin";
import { ImportForm } from "./import-form";

export const metadata = { title: "앱 일괄 등록" };

export default async function AdminAppImportPage() {
  const user = await requireAdminUser("/admin/apps/import");

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <Link href="/admin" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← 관리자
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-neutral-900">앱 일괄 등록</h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          이미 수집한 사용자 이메일 + 앱 정보를 JSON 으로 붙여넣으면 한 번에 등록됩니다. 미가입
          이메일은 placeholder 사용자로 만들어지고, 추후 같은 이메일로 Google 로그인 하면 자동으로 본인 앱으로 매칭됩니다.
        </p>

        <section className="mt-8 rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
          <h2 className="text-sm font-semibold text-neutral-900">입력 형식 (JSON 배열)</h2>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-neutral-900 p-4 text-xs leading-relaxed text-neutral-100">{`[
  {
    "email": "owner@example.com",
    "nickname": "닉네임 (선택)",
    "app_name": "앱 이름",
    "store_invite_url": "https://play.google.com/apps/test/... (선택)",
    "web_invite_url": "https://play.google.com/apps/testing/... (선택)",
    "required_testers": 12,
    "short_description": "한 줄 설명",
    "status": "matching"
  }
]`}</pre>
          <ul className="mt-3 space-y-1 text-xs text-neutral-600">
            <li>· <strong>store_invite_url / web_invite_url</strong> 선택. 없으면 생략 가능 (나중에 앱 소유자가 등록)</li>
            <li>· <strong>required_testers</strong> 기본 12, 0~100 범위</li>
            <li>· <strong>status</strong> 기본 &quot;matching&quot;. 다른 값: reviewing / launched / paused</li>
            <li>· <strong>nickname</strong> 생략 시 이메일 prefix 가 사용됨</li>
            <li>· <strong>short_description</strong> 이 비어 있으면 기본 문구가 사용됨</li>
            <li>· 200건 단위로 나눠 순차 등록됩니다</li>
          </ul>
        </section>

        <div className="mt-8">
          <ImportForm />
        </div>
      </main>
    </>
  );
}
