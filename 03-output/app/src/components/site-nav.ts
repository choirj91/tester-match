/**
 * 헤더 메뉴 — 1차 4개 아래 2차 메뉴 (Design C §6).
 * 모바일 탭 바도 같은 4개를 쓴다.
 */
export type NavLink = { href: string; label: string };
export type NavSection = {
  key: "test" | "recruit" | "community" | "me";
  label: string;
  href: string;
  /** 비로그인이면 로그인으로 보낸다 */
  requiresAuth?: boolean;
  links: readonly NavLink[];
  /** 이 섹션이 활성으로 잡히는 경로 접두어 (links 외 추가분) */
  extraPrefixes?: readonly string[];
};

export const NAV_SECTIONS: readonly NavSection[] = [
  {
    key: "test",
    label: "테스트하기",
    href: "/browse",
    links: [
      { href: "/browse", label: "매칭 가능" },
      { href: "/my-tests", label: "내 테스트" },
    ],
  },
  {
    key: "recruit",
    label: "테스터 모으기",
    href: "/apps",
    links: [
      { href: "/apps", label: "내 앱" },
      { href: "/paid-testers", label: "급구" },
      { href: "/my-reviews", label: "맞테스트" },
    ],
    extraPrefixes: ["/console", "/boost"],
  },
  {
    key: "community",
    label: "커뮤니티",
    href: "/board",
    links: [
      { href: "/board", label: "게시판" },
      { href: "/guide", label: "가이드" },
      { href: "/stats", label: "랭킹" },
    ],
  },
  {
    key: "me",
    label: "내 공간",
    href: "/rewards",
    requiresAuth: true,
    links: [
      { href: "/rewards", label: "보상" },
      { href: "/credits", label: "크레딧" },
      { href: "/profile", label: "프로필" },
      { href: "/notifications", label: "알림" },
    ],
  },
];

function matches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function activeSection(pathname: string): NavSection | null {
  return (
    NAV_SECTIONS.find((s) =>
      [...s.links.map((l) => l.href), ...(s.extraPrefixes ?? [])].some((p) => matches(pathname, p)),
    ) ?? null
  );
}

export function isActiveLink(pathname: string, href: string): boolean {
  return matches(pathname, href);
}

export function sectionHref(section: NavSection, signedIn: boolean): string {
  // 로그인 페이지는 돌아갈 경로(next)를 받지 않는다
  if (section.requiresAuth && !signedIn) return "/auth/login";
  return section.href;
}
