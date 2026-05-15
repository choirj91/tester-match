export function FloatButtons() {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* 이메일 문의 버튼 */}
      <div className="group relative">
        <span className="pointer-events-none absolute right-full top-1/2 mr-2.5 -translate-y-1/2 whitespace-nowrap rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100">
          이메일 문의
        </span>
        <a
          href="https://mail.google.com/mail/?view=cm&fs=1&to=choirj91@gmail.com&su=Tester%20Match%20%EB%AC%B8%EC%9D%98"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="이메일 문의하기"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-neutral-200 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl active:scale-95"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="2" y="4" width="20" height="16" rx="3" stroke="#374151" strokeWidth="1.8" fill="none"/>
            <path d="M2 7.5l10 6.5 10-6.5" stroke="#374151" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </a>
      </div>

      {/* 카카오 오픈채팅 버튼 */}
      <div className="group relative">
        <span className="pointer-events-none absolute right-full top-1/2 mr-2.5 -translate-y-1/2 whitespace-nowrap rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100">
          카카오 오픈채팅 참여하기
        </span>
        <a
          href="https://open.kakao.com/o/ghJ9350f"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="카카오톡 오픈채팅 참여하기"
          className="flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all duration-200 hover:-translate-y-1 hover:shadow-xl active:scale-95"
          style={{ backgroundColor: "#FEE500" }}
        >
          <svg width="26" height="26" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <ellipse cx="24" cy="22" rx="20" ry="16" fill="#3C1E1E" />
            <path d="M16 36 C14 40 10 42 8 44 C12 42 18 40 20 36" fill="#3C1E1E" />
            <circle cx="16" cy="22" r="2.5" fill="#FEE500" />
            <circle cx="24" cy="22" r="2.5" fill="#FEE500" />
            <circle cx="32" cy="22" r="2.5" fill="#FEE500" />
          </svg>
        </a>
      </div>
    </div>
  );
}

/** @deprecated FloatButtons 로 통합됨 */
export const KakaoFloatButton = FloatButtons;
