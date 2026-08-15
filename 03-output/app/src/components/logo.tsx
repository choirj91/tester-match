/**
 * Tester Match 로고 마크 — 하이파이브하는 두 테스터 + 매치 스파크.
 * 단일 소스: 여기 수정하면 헤더 전체 반영. 파비콘·OG 는 public/brand/ 참조.
 */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g transform="rotate(10 28 52)">
        <circle cx="28" cy="32" r="13" fill="#2563eb" />
        <path d="M6 80 v-10 a22 22 0 0 1 44 0 v10 z" fill="#2563eb" />
      </g>
      <g transform="rotate(-10 68 52)">
        <circle cx="68" cy="32" r="13" fill="#10b981" />
        <path d="M46 80 v-10 a22 22 0 0 1 44 0 v10 z" fill="#10b981" />
      </g>
      <path
        d="M48 2 l3.5 8.5 l8.5 3.5 l-8.5 3.5 l-3.5 8.5 l-3.5 -8.5 l-8.5 -3.5 l8.5 -3.5 z"
        fill="#ff6b5b"
      />
    </svg>
  );
}
