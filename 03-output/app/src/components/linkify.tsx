import { SITE_URL } from "@/lib/site";

const URL_RE = /(https?:\/\/[^\s<>"'）)\]]+)/g;

/**
 * 평문 속 http(s) URL 을 자동으로 <a> 링크로 변환.
 * React 텍스트 이스케이프를 유지한 채 분할만 하므로 XSS 안전.
 * 내부 링크(SITE_URL)는 같은 탭, 외부 링크는 새 탭 + noopener.
 */
export function Linkify({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((part, i) => {
        if (!part.match(URL_RE)) return part;
        const internal = part.startsWith(SITE_URL);
        return (
          <a
            key={i}
            href={part}
            {...(internal ? {} : { target: "_blank", rel: "noopener noreferrer" })}
            className="break-all text-trust-600 underline underline-offset-2 hover:text-trust-700"
          >
            {part}
          </a>
        );
      })}
    </>
  );
}
