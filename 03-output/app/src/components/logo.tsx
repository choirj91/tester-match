/**
 * Tester Match 로고 마크 — 먹색 사각 칸 + 버밀리언 체크 (Design C).
 * 단일 소스: 여기 수정하면 헤더 전체 반영. 파비콘·OG 는 public/brand/ 참조.
 */
export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 26 26"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="1.5" y="1.5" width="23" height="23" stroke="#111111" strokeWidth="1.8" />
      <path
        d="M7 13.5l4 4 8-9"
        stroke="#C8371F"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
