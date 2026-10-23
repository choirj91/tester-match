"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { closedKey, hideKey, hideUntilFrom, shouldShowNotice } from "@/lib/notice-popup";
import { CONTACT_EMAIL, OPEN_CHAT_URL } from "@/lib/site";

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
              가짜 &lsquo;로봇 확인&rsquo; 화면 점검 결과와 보안 조치 안내
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
            최근 &ldquo;나는 로봇이 아닙니다&rdquo; 화면을 흉내 낸 가짜 캡차로 악성코드를 설치하게
            만드는 피해가 늘고 있고, 오픈채팅방에서도 제보가 들어왔습니다. 불안하셨을 텐데, 사이트
            전체와 운영 데이터베이스를 점검한 결과를 숨김없이 정리해 드립니다.
          </p>

          <Section title="이 화면의 정체: 특정 사이트가 아닌 전 세계 대량 공격입니다">
            <p>
              제보된 화면의 &ldquo;I am not a robot - reCAPTCHA Verification ID: (숫자)&rdquo;
              문구는 &lsquo;ClickFix&rsquo;라는 공격에서 공통으로 쓰는 고정 문구입니다.
            </p>
            <p>
              이 공격은 특정 사이트를 노리지 않습니다. 해킹된 블로그나 쇼핑몰 같은 수많은 사이트에
              같은 코드를 한꺼번에 심어 두고, 그 사이트에 들른 사람에게 무작위로 이 화면을 띄웁니다.
            </p>
            <p>
              이미 PC가 감염됐거나 악성 브라우저 확장 프로그램이 깔려 있으면, 어떤 사이트를 방문하든
              그 위에 이 화면이 덧씌워질 수 있습니다. 그래서 평소 자주 가는 사이트에서 갑자기 뜬
              것처럼 보이기도 합니다.
            </p>
          </Section>

          <Section title="꼭 기억해 주세요">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                진짜 로봇 확인(reCAPTCHA)은 절대로 <strong>Win+R, Win+X</strong> 같은 단축키를
                누르게 하거나{" "}
                <strong>
                  PowerShell·명령 프롬프트·터미널에 무언가를 붙여넣으라고 하지 않습니다.
                </strong>{" "}
                이런 안내가 나오면 그 자체가 공격입니다. 바로 창을 닫아 주세요.
              </li>
              <li>
                Tester Match는 어떤 경우에도 명령어 실행이나 프로그램 설치를 요청하지 않습니다.
              </li>
            </ul>
          </Section>

          <Section title="Tester Match 점검 결과">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>사이트 코드와 공개 페이지 전체: 악성 코드 없음</li>
              <li>
                등록된 앱 1,349개(삭제된 앱 포함)의 초대 링크 2,694개: 모두 실제 Google Play 주소
              </li>
              <li>게시글, 댓글, 앱 설명 전체: 몰래 심어진 스크립트 0건</li>
              <li>게시글에 걸린 외부 사이트 중 접속 가능한 150여 곳: 이상 없음</li>
              <li>회사 홈페이지와 도메인 설정: 정상</li>
            </ul>
          </Section>

          <Section title="점검 중 발견한 것 ①: Google 주소가 아닌 링크 1건">
            <p>
              Google 그룹 링크 648개 중 1건이 Google이 아닌 외부 웹사이트 주소였습니다. 한 개발자
              계정이 그룹 링크 칸에 등록한 주소입니다.
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                해당 사이트의 코드를 직접 내려받아 확인한 결과 악성 코드는 없었습니다. 그 개발자가
                만든 앱의 웹 버전 페이지였고, 그룹 링크 칸에 실수로 넣은 것으로 보입니다.
              </li>
              <li>
                이 앱은 9월 13일에 이미 삭제되어 지금은 회원 화면에 나오지 않습니다. 6~9월에 이 앱에
                참여한 분께는 &lsquo;그룹 가입&rsquo; 버튼으로 보였을 수 있지만, 위와 같이 악성
                사이트는 아니었습니다.
              </li>
              <li>
                그래도 Google 주소가 아닌 링크가 화면에 나갈 수 있었다는 점은 고쳐야 할 문제라고
                판단해 바로 막았습니다.
              </li>
            </ul>
          </Section>

          <Section title="점검 중 발견한 것 ②: 초대 링크 검사의 허점">
            <p>
              앱을 등록할 때 넣는 초대 링크는 Google Play 주소만 받도록 되어 있었습니다. 그런데 주소
              어딘가에 &lsquo;play.google.com&rsquo;이라는 글자만 들어 있으면 통과되는 허점이
              있었습니다. 실제로 악용된 링크는 한 건도 없었지만, 마음만 먹으면 Play 링크처럼 보이는
              가짜 주소를 넣을 수 있었다는 뜻이라 함께 막았습니다.
            </p>
          </Section>

          <Section title="적용한 보안 조치">
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>
                초대 링크는 주소가 정확히 play.google.com, 그룹 링크는 정확히 groups.google.com 인
                경우에만 받습니다.
              </li>
              <li>
                이미 저장된 링크도 화면에 보여주기 직전에 다시 검사합니다. Google 주소가 아니면
                링크를 아예 표시하지 않습니다.
              </li>
              <li>회원이 쓴 글이 페이지 안에서 코드로 실행될 수 없도록 처리를 강화했습니다.</li>
              <li>
                초대 링크는 테스트에 참여 신청한 회원에게만 보이도록, 외부에서 조회할 수 있던 경로를
                막았습니다.
              </li>
            </ol>
          </Section>

          <Section title="이 화면을 보셨다면, 내 PC도 꼭 한 번 점검해 주세요">
            <p>
              Tester Match에서 퍼진 흔적은 없었지만, 이 화면을 보셨다면 다른 곳에서 이미 감염됐을
              가능성이 있습니다. 아무것도 실행하지 않으셨더라도 아래를 한 번 확인해 주세요.
            </p>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>
                크롬 주소창에 <span className="font-mono">chrome://extensions</span> 를 입력하고,
                설치한 기억이 없거나 쓰지 않는 확장 프로그램을 삭제해 주세요.
              </li>
              <li>Windows 보안(Defender)에서 &lsquo;전체 검사&rsquo;를 실행해 주세요.</li>
              <li>크롬 설정 → 설정 초기화 → &lsquo;설정을 기본값으로 복원&rsquo;을 눌러 주세요.</li>
              <li>
                같은 화면이 여러 사이트에서 계속 뜬다면 PC가 감염됐을 가능성이 높습니다. 아래 단계를
                따라 주세요.
              </li>
            </ol>
          </Section>

          <Section title="이미 붙여넣고 실행하셨다면">
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>PC의 인터넷 연결(Wi-Fi, 랜선)부터 끊어 주세요.</li>
              <li>
                휴대폰 등 다른 기기에서 Google 계정을 비롯한 주요 계정의 비밀번호를 바꾸고 2단계
                인증을 켜 주세요. 브라우저에 저장해 둔 비밀번호는 모두 유출됐다고 보고 바꾸시는 게
                안전합니다.
              </li>
              <li>
                Google 계정 &lsquo;보안&rsquo; 메뉴에서 모르는 기기의 로그인이 있으면 로그아웃시켜
                주세요. Play Console 개발자 계정도 꼭 확인해 주세요.
              </li>
              <li>
                Windows 보안(Defender)으로 전체 검사를 실행해 주세요. 불안하시면 PC 초기화도 고려해
                주세요.
              </li>
              <li>도움이 필요하시면 한국인터넷진흥원 118(국번 없이)에서 상담받으실 수 있습니다.</li>
            </ol>
          </Section>

          <Section title="제보 부탁드립니다">
            <p>
              이상한 화면을 보셨다면 아래 내용을{" "}
              <a
                href={OPEN_CHAT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink-900 hover:text-accent-600 underline"
              >
                오픈채팅방
              </a>
              이나{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-ink-900 hover:text-accent-600 underline"
              >
                {CONTACT_EMAIL}
              </a>{" "}
              로 보내 주세요. 원인을 끝까지 찾는 데 큰 도움이 됩니다.
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>화면이 뜨기 직전 페이지의 주소(주소창 캡처)</li>
              <li>어떤 링크나 버튼을 눌렀는지</li>
              <li>사용 중인 브라우저와 설치된 확장 프로그램</li>
            </ul>
          </Section>

          <p className="mt-5">
            AI가 발전하면서 공격 화면도 점점 진짜처럼 보이고 있습니다. 화면이 아무리 그럴듯해도
            명령어를 붙여넣으라는 요청은 무조건 의심해 주세요. 앞으로도 점검 결과는 숨김없이
            공유드리겠습니다.
          </p>
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
