"use client";

import { Mail, MessageCircle, MoreVertical, X } from "lucide-react";
import { useState } from "react";
import { NoticeFloatButton } from "@/components/notice-float-button";
import { CONTACT_EMAIL, OPEN_CHAT_URL } from "@/lib/site";

const MAIL_COMPOSE_URL = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(CONTACT_EMAIL)}&su=${encodeURIComponent("Tester Match 문의")}`;

const FLOAT_BUTTON_CLASS =
  "relative flex size-11 items-center justify-center bg-ink-900 text-white hover:bg-black";

/**
 * 떠 있는 버튼 (Design C §5.16) — 공지·문의 메일·오픈채팅을 하나의 세로 스택으로.
 * 모바일에서는 하단 탭 바 위로 올리고, 본문을 가리지 않게 버튼 하나로 접어 둔다.
 */
export function FloatButtons() {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed right-4 bottom-[calc(72px+env(safe-area-inset-bottom))] z-40 flex flex-col items-end gap-px min-[761px]:right-6 min-[761px]:bottom-6">
      <div
        id="float-actions"
        className={`${open ? "flex" : "hidden"} flex-col gap-px bg-white min-[761px]:flex`}
      >
        <NoticeFloatButton />
        <a
          href={MAIL_COMPOSE_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="이메일 문의하기"
          title="이메일 문의"
          className={FLOAT_BUTTON_CLASS}
        >
          <Mail className="size-5" strokeWidth={1.8} aria-hidden="true" />
        </a>
        <a
          href={OPEN_CHAT_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="카카오톡 오픈채팅 참여하기"
          title="카카오 오픈채팅"
          className={FLOAT_BUTTON_CLASS}
        >
          <MessageCircle className="size-5" strokeWidth={1.8} aria-hidden="true" />
        </a>
      </div>
      <button
        type="button"
        aria-label={open ? "공지·문의 닫기" : "공지·문의 열기"}
        aria-expanded={open}
        aria-controls="float-actions"
        onClick={() => setOpen((v) => !v)}
        className={`${FLOAT_BUTTON_CLASS} min-[761px]:hidden`}
      >
        {open ? (
          <X className="size-5" strokeWidth={1.8} aria-hidden="true" />
        ) : (
          <MoreVertical className="size-5" strokeWidth={1.8} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

/** @deprecated FloatButtons 로 통합됨 */
export const KakaoFloatButton = FloatButtons;
