"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { closedKey, hideKey, hideUntilFrom, shouldShowNotice } from "@/lib/notice-popup";
import { CONTACT_EMAIL } from "@/lib/site";

/**
 * 2026-10-23 가짜 캡차(ClickFix) 제보 대응 공지 팝업.
 * showUntil 이 지나면 아무에게도 뜨지 않는다. 다음 공지는 id 를 바꿔야 다시 뜬다.
 */
const NOTICE = { id: "clickfix-2026-10", showUntil: "2026-11-06T00:00:00+09:00" };

function readStorage(getStorage: () => Storage, key: string): string | null {
  try {
    return getStorage().getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(getStorage: () => Storage, key: string, value: string) {
  try {
    getStorage().setItem(key, value);
  } catch {
    // 사생활 보호 모드 등 저장소를 못 쓰면 이번 화면에서만 닫힌다
  }
}

function rememberClosedForSession() {
  writeStorage(() => window.sessionStorage, closedKey(NOTICE.id), "1");
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="text-ink-900 text-[15px] font-bold">{title}</h3>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}

export function SecurityNoticePopup() {
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setOpen(
      shouldShowNotice({
        now: Date.now(),
        showUntil: NOTICE.showUntil,
        hiddenUntil: readStorage(() => window.localStorage, hideKey(NOTICE.id)),
        closedThisSession: readStorage(() => window.sessionStorage, closedKey(NOTICE.id)) === "1",
      }),
    );
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      rememberClosedForSession();
      setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!open) return null;

  const close = () => {
    rememberClosedForSession();
    setOpen(false);
  };
  const hideForAWeek = () => {
    writeStorage(() => window.localStorage, hideKey(NOTICE.id), String(hideUntilFrom(Date.now())));
    setOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="security-notice-title"
        className="flex max-h-[85vh] w-full max-w-[560px] flex-col bg-white shadow-xl"
      >
        <div className="border-ink-200 flex items-start justify-between gap-3 border-b px-5 py-4">
          <div>
            <p className="text-accent-600 font-mono text-[11px] font-bold tracking-wide">
              보안 공지
            </p>
            <h2 id="security-notice-title" className="text-ink-900 mt-1 text-lg font-bold">
              보안 사고 안내와 조치 결과
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={close}
            aria-label="공지 닫기"
            className="text-ink-600 hover:text-ink-900 -m-2 p-2"
          >
            <X className="size-5" strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>

        <div className="text-ink-700 overflow-y-auto px-5 pb-5 text-sm leading-relaxed">
          <p className="mt-4">
            Tester Match를 이용하시며 불안을 겪게 해드려 진심으로 사과드립니다. 확인된 내용과 조치를
            숨김없이 알려드립니다.
          </p>

          <Section title="무슨 일이 있었나">
            <p>
              10월 18일 오후부터 10월 23일 오전 사이, Tester Match에 접속하면 가짜 &lsquo;로봇
              확인(reCAPTCHA)&rsquo; 화면이 뜰 수 있었습니다.
            </p>
            <p>
              저희가 작성한 사이트 코드에는 이상이 없었지만, 서버가 사용하던 웹 프로그램(Next.js)의
              알려진 보안 취약점을 통해 외부 공격자가 침입해 페이지에 악성 스크립트를 끼워
              넣었습니다. 그 이전 기간에도 같은 일이 있었는지 계속 조사하고 있습니다.
            </p>
          </Section>

          <Section title="이 화면의 정체">
            <p>
              &lsquo;ClickFix&rsquo;라는 대량 공격에서 쓰는 화면입니다. 진짜 로봇 확인은 절대로{" "}
              <strong>Win+R·Win+X</strong>를 누르게 하거나{" "}
              <strong>PowerShell·터미널에 무언가를 붙여넣으라고 하지 않습니다.</strong> 이런 안내가
              보이면 바로 창을 닫아 주세요. Tester Match는 어떤 경우에도 명령어 실행이나 프로그램
              설치를 요청하지 않습니다.
            </p>
          </Section>

          <Section title="조치 결과">
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>
                10월 23일 오전 사이트 접속을 차단하고 취약점을 패치했습니다. 악성 스크립트가 모두
                제거된 것을 확인한 뒤 다시 열었습니다.
              </li>
              <li>서버의 접속키와 비밀번호를 모두 교체했습니다.</li>
              <li>관계 기관에 신고했습니다.</li>
              <li>
                초대 링크와 그룹 링크는 Google 주소만 받고, 화면에 보여주기 직전에도 다시
                검사합니다.
              </li>
              <li>회원이 쓴 글이 페이지 안에서 코드로 실행되지 않도록 처리를 강화했습니다.</li>
            </ol>
          </Section>

          <Section title="명령어를 실행하신 적이 있다면 알려 주세요">
            <p>
              이 공격은 화면의 안내에 따라 직접 명령어를 붙여넣고 실행해야 피해가 생기는 방식입니다.
              화면을 보기만 하셨거나 창을 닫으셨다면 걱정하지 않으셔도 됩니다.
            </p>
            <p>
              혹시 Tester Match에서 뜬 가짜 로봇 확인 화면의 안내대로 Win+R·Win+X 창이나 터미널에
              명령어를 입력하신 적이 있다면{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-ink-900 hover:text-accent-600 underline"
              >
                {CONTACT_EMAIL}
              </a>
              로 알려 주세요. 상황에 맞는 조치를 함께 안내해 드리고, 피해 회복을 최대한 돕겠습니다.
            </p>
          </Section>

          <p className="mt-5">불편과 불안을 드려 다시 한번 사과드립니다.</p>
        </div>

        <div className="border-ink-200 flex gap-2 border-t px-5 py-3">
          <Button variant="secondary" size="sm" onClick={hideForAWeek} className="flex-1">
            일주일 동안 보지 않기
          </Button>
          <Button size="sm" onClick={close} className="flex-1">
            닫기
          </Button>
        </div>
      </div>
    </div>
  );
}
