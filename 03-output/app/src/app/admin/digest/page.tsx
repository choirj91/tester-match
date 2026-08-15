import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { requireAdminUser } from "@/lib/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SITE_URL, OPEN_CHAT_URL } from "@/lib/site";
import { NOTICE_CATEGORY } from "@/lib/validators/post";
import { DigestActions } from "./digest-actions";

export const runtime = "edge";
export const metadata = { title: "오픈채팅 다이제스트" };

const DEFAULT_HEADER =
  "앱 하나로 정말 돈을 벌 수 있을까요?\n오늘은 인디 앱 개발자들의 수익과 시행착오가 솔직하게 담긴 글을 골라봤습니다.";

/**
 * 오픈채팅 공지용 다이제스트 생성기.
 *
 * 사용:
 *   /admin/digest                → 최근 등록된 "이야기" 글 3편 자동 선택
 *   /admin/digest?ids=17,18,19   → 지정한 글로 구성
 *   /admin/digest?h=헤더문구      → 헤더 교체 (URL 인코딩)
 *
 * 오픈채팅 게시물은 길이 제한이 없으므로 카톡 API(200자)와 달리
 * "제목 + 개별 URL" 풀 포맷을 그대로 쓴다.
 */
export default async function AdminDigestPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string; h?: string }>;
}) {
  const user = await requireAdminUser("/admin/digest");
  const { ids: idsParam, h: headerParam } = await searchParams;
  const supabase = createSupabaseAdminClient();

  const ids = (idsParam ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 5);

  let query = supabase
    .from("posts")
    .select("id, title, category, created_at")
    .is("deleted_at", null);
  if (ids.length > 0) {
    query = query.in("id", ids);
  } else {
    query = query.eq("category", "이야기").neq("category", NOTICE_CATEGORY).order("id", { ascending: false }).limit(3);
  }
  const { data: posts } = await query;

  // ?ids= 지정 시 지정 순서 유지
  const ordered =
    ids.length > 0
      ? ids.map((id) => (posts ?? []).find((p) => p.id === id)).filter((p) => p != null)
      : (posts ?? []);

  const header = headerParam?.trim() || DEFAULT_HEADER;
  const message =
    ordered.length === 0
      ? ""
      : [
          header,
          "",
          ...ordered.flatMap((p, i) => [`${i + 1}. ${p.title}`, `${SITE_URL}/board/${p.id}`]),
        ].join("\n");

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/admin" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← 관리자
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-neutral-900">오픈채팅 다이제스트</h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          아래 메시지를 복사해서 오픈 카톡방에 붙여넣고 공지로 등록하세요.
          글 선택: <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">?ids=17,18,19</code>{" "}
          · 헤더 교체: <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">?h=문구</code>{" "}
          (미지정 시 최근 이야기 3편 + 기본 헤더)
        </p>

        {ordered.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
            대상 글이 없습니다. 이야기 카테고리에 글을 등록하거나 ?ids= 로 지정하세요.
          </p>
        ) : (
          <>
            <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                미리보기 ({message.length}자)
              </p>
              <pre className="mt-3 whitespace-pre-wrap break-all font-sans text-sm leading-7 text-neutral-800">
                {message}
              </pre>
            </div>
            <DigestActions message={message} openChatUrl={OPEN_CHAT_URL} />
            <p className="mt-3 text-xs text-neutral-400">
              순서: 복사 → 오픈 카톡방 열기 → 붙여넣기 → 전송 후 메시지 길게 눌러 공지 등록
            </p>
          </>
        )}
      </main>
    </>
  );
}
