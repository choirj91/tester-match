import { paidSeatNudgeLines, type ReminderItem } from "@/lib/checkin-reminder";
import { PAID_TESTER_PRICE_KRW } from "@/lib/paid-testers";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const layoutHtml = (innerHtml: string, footerNote = "") => `
<!doctype html>
<html lang="ko">
  <head><meta charset="utf-8"></head>
  <body style="margin:0;font-family:'Pretendard',-apple-system,sans-serif;background:#f8fafc;color:#0f172a;">
    <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
      <h1 style="margin:0 0 24px;font-size:18px;color:#2563eb;font-weight:700;">Tester Match</h1>
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px;font-size:15px;line-height:1.6;">
        ${innerHtml}
      </div>
      <p style="margin-top:24px;font-size:12px;color:#64748b;line-height:1.5;">
        ${footerNote || `이 메일은 <a href="${APP_URL}" style="color:#2563eb;">Tester Match</a> 알림입니다.`}
      </p>
    </div>
  </body>
</html>
`;

export type Email = { subject: string; html: string; text: string };

export function matchOptInEmail(args: {
  ownerNickname: string;
  appName: string;
  testerNickname: string;
  testerTrustScore: number;
  remainingCount: number;
  appId: number;
}): Email {
  const subject = `[Tester Match] "${args.appName}" 새 테스터 — ${args.testerNickname}`;
  const html = layoutHtml(`
    <p style="margin:0 0 12px;"><strong>${escapeHtml(args.ownerNickname)}</strong> 님,</p>
    <p style="margin:0 0 16px;">
      등록한 앱 <strong>${escapeHtml(args.appName)}</strong> 에 테스터 한 명이 새로 참여했습니다.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
      <tr><td style="padding:6px 0;color:#64748b;">테스터</td><td>${escapeHtml(args.testerNickname)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;">신뢰 점수</td><td>${args.testerTrustScore}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;">남은 정원</td><td>${args.remainingCount}명</td></tr>
    </table>
    <p style="margin:24px 0 0;">
      <a href="${APP_URL}/apps/${args.appId}"
         style="display:inline-block;background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;">
        앱 상세 보기
      </a>
    </p>
  `);
  const text = `${args.ownerNickname} 님, "${args.appName}" 에 새 테스터 ${args.testerNickname}(신뢰 ${args.testerTrustScore}) 참여. 남은 정원 ${args.remainingCount}명.\n${APP_URL}/apps/${args.appId}`;
  return { subject, html, text };
}

export function dailyCheckinReminderEmail(args: {
  testerNickname: string;
  items: ReminderItem[];
}): Email {
  const paid = args.items.filter((i) => i.paidSeat);
  const free = args.items.filter((i) => !i.paidSeat);
  const urgent = paid.some((i) => i.paidSeat?.lastChance);
  const subject = urgent
    ? "[Tester Match] 오늘 체크인하지 않으면 유료 시트가 해제됩니다"
    : paid.length > 0
      ? `[Tester Match] 유료 시트 오늘 체크인이 남았습니다 (${paid.length}개)`
      : `[Tester Match] 오늘 체크인할 앱 ${args.items.length}개`;

  const paidHtml = paid
    .map((i) => {
      const tone = i.paidSeat?.lastChance
        ? "border:1px solid #f87171;background:#fef2f2;"
        : "border:1px solid #fcd34d;background:#fffbeb;";
      const lines = paidSeatNudgeLines(i)
        .map((l) => `<p style="margin:3px 0;font-size:14px;">${escapeHtml(l)}</p>`)
        .join("");
      return `<div style="margin:0 0 12px;padding:14px 16px;border-radius:12px;${tone}">
        <p style="margin:0 0 6px;font-weight:700;">${escapeHtml(i.name)} — ${i.dayN}일차</p>${lines}
      </div>`;
    })
    .join("");
  const freeHtml =
    free.length === 0
      ? ""
      : `<p style="margin:16px 0 8px;">품앗이 체크인 ${free.length}개</p>
    <ul style="margin:0 0 16px;padding-left:20px;">${free
      .map((a) => `<li style="margin:6px 0;"><strong>${escapeHtml(a.name)}</strong> — ${a.dayN}일차</li>`)
      .join("")}</ul>`;
  const notes = [
    paid.length > 0
      ? "유료 시트는 앱 실행 화면 스크린샷 1장과 함께 체크인해야 출석으로 인정됩니다. 결석이 3일이 되면 시트가 해제됩니다."
      : "",
    free.length > 0 ? "품앗이 체크인을 5일 연속 놓치면 페널티가 부과됩니다." : "",
  ].filter(Boolean);

  const html = layoutHtml(`
    <p style="margin:0 0 12px;"><strong>${escapeHtml(args.testerNickname)}</strong> 님,</p>
    <p style="margin:0 0 16px;">오늘 체크인이 필요한 앱 ${args.items.length}개가 있습니다.</p>
    ${paidHtml}${freeHtml}
    <p style="margin:24px 0 0;">
      <a href="${APP_URL}/my-tests"
         style="display:inline-block;background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;">
        지금 체크인하기
      </a>
    </p>
    ${notes.map((n) => `<p style="margin:16px 0 0;font-size:13px;color:#64748b;">${n}</p>`).join("")}
  `);
  const text = [
    `${args.testerNickname} 님, 오늘 체크인이 필요한 앱 ${args.items.length}개:`,
    ...paid.map((i) => `${i.name} (${i.dayN}일차) — ${paidSeatNudgeLines(i).join(" ")}`),
    ...free.map((a) => `- ${a.name} (${a.dayN}일차)`),
    "",
    `체크인: ${APP_URL}/my-tests`,
    ...notes,
  ].join("\n");
  return { subject, html, text };
}

/** 테스터 요청 이메일 — 앱 소유자가 다른 사용자에게 직접 발송 */
export function testerRequestEmail(args: {
  senderNickname: string;
  recipientNickname: string;
  appName: string;
  appId: number;
  subject: string;
  message: string;
}): Email {
  const lines = args.message
    .split("\n")
    .map((l) => `<p style="margin:0 0 10px;">${l === "" ? "&nbsp;" : escapeHtml(l)}</p>`)
    .join("");
  const html = layoutHtml(
    `
    <p style="margin:0 0 16px;"><strong>${escapeHtml(args.recipientNickname)}</strong> 님,</p>
    ${lines}
    <p style="margin:28px 0 0;">
      <a href="${APP_URL}/browse/${args.appId}"
         style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
        테스트 참여하기 →
      </a>
    </p>
    `,
    `이 메일은 Tester Match 회원 <strong>${escapeHtml(args.senderNickname)}</strong>님의 테스터 요청입니다. 원치 않으시면 무시하셔도 됩니다.`,
  );
  const text = `${args.recipientNickname} 님,\n\n${args.message}\n\n테스트 참여: ${APP_URL}/browse/${args.appId}`;
  return { subject: args.subject, html, text };
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** 유료 테스터 결제 발생 — 관리자 즉시 알림 (ADR-0011) */
export function paidOrderAdminEmail(args: {
  orderCode: string;
  appName: string;
  appId: number;
  buyerNickname: string;
  buyerEmail: string;
  testerCount: number;
  amountKrw: number;
}): Email {
  const amount = args.amountKrw.toLocaleString("ko-KR");
  const subject = `[Tester Match] 유료 테스터 결제 — ${args.appName} ${args.testerCount}명 (${amount}원)`;
  const html = layoutHtml(`
    <p style="margin:0 0 16px;font-weight:700;">유료 테스터 주문이 결제되었습니다.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
      <tr><td style="padding:6px 0;color:#64748b;">앱</td><td><strong>${escapeHtml(args.appName)}</strong></td></tr>
      <tr><td style="padding:6px 0;color:#64748b;">구매자</td><td>${escapeHtml(args.buyerNickname)} (${escapeHtml(args.buyerEmail)})</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;">인원</td><td>${args.testerCount}명 × ${PAID_TESTER_PRICE_KRW.toLocaleString("ko-KR")}원</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;">금액</td><td><strong>${amount}원</strong></td></tr>
      <tr><td style="padding:6px 0;color:#64748b;">주문번호</td><td>${args.orderCode}</td></tr>
    </table>
    <p style="margin:0 0 16px;font-size:13px;color:#64748b;">
      다음 액션: tester 계정으로 앱을 설치하고 테스트를 개시한 뒤, 관리자 페이지에서
      주문을 "진행 중"으로 전환하세요.
    </p>
    <p style="margin:24px 0 0;">
      <a href="${APP_URL}/admin/paid-orders"
         style="display:inline-block;background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;">
        주문 관리 열기
      </a>
    </p>
  `);
  const text = `유료 테스터 결제 — ${args.appName} / ${args.buyerNickname}(${args.buyerEmail}) / ${args.testerCount}명 / ${amount}원 / ${args.orderCode}\n${APP_URL}/admin/paid-orders`;
  return { subject, html, text };
}

/** 유료 테스터 결제 영수 안내 — 구매자용 (ADR-0011) */
export function paidOrderReceiptEmail(args: {
  buyerNickname: string;
  appName: string;
  testerCount: number;
  amountKrw: number;
  orderCode: string;
  /** false = 심사·시험용 주문 — 시트를 열지 않아 급구·전 회원 알림이 없다 */
  seatsOpened: boolean;
}): Email {
  const amount = args.amountKrw.toLocaleString("ko-KR");
  const subject = `[Tester Match] 유료 테스터 신청 완료 — ${args.appName}`;
  const progress = args.seatsOpened
    ? "급구 노출과 전 회원 알림이 나갔고, 커뮤니티 테스터가 시트를 채우면 14일간 매일 스크린샷 체크인합니다."
    : "심사·시험용 주문이라 시트를 열지 않았습니다. 급구 표시와 전 회원 알림은 실제 주문에서만 나갑니다.";
  const footer = args.seatsOpened
    ? `테스터 참여 현황과 매일의 스크린샷은 콘솔에서 확인할 수 있습니다. 완주한 시트만 과금되며,
      결제 후 7일 내 채워지지 않은 시트는 자동 환불됩니다. Play Console 비공개 테스트 트랙에
      공용 테스터 그룹(tester-match@googlegroups.com)이 등록돼 있는지 꼭 확인해주세요.`
    : "주문 내용은 콘솔에서 확인할 수 있습니다. 결제 취소·환불은 운영팀이 처리합니다.";
  const html = layoutHtml(`
    <p style="margin:0 0 12px;"><strong>${escapeHtml(args.buyerNickname)}</strong> 님,</p>
    <p style="margin:0 0 16px;">
      <strong>${escapeHtml(args.appName)}</strong> 유료 테스터 신청이 완료되었습니다.
      ${progress}
    </p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
      <tr><td style="padding:6px 0;color:#64748b;">인원</td><td>${args.testerCount}명</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;">결제 금액</td><td>${amount}원</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;">주문번호</td><td>${args.orderCode}</td></tr>
    </table>
    <p style="margin:0 0 16px;font-size:13px;color:#64748b;">
      ${footer}
    </p>
    <p style="margin:24px 0 0;">
      <a href="${APP_URL}/paid-testers"
         style="display:inline-block;background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;">
        주문 현황 보기
      </a>
    </p>
  `);
  const text = `${args.buyerNickname} 님, "${args.appName}" 유료 테스터 ${args.testerCount}명 신청 완료 (${amount}원, ${args.orderCode}).\n${APP_URL}/paid-testers`;
  return { subject, html, text };
}

/** 유료 테스터 일일 운영 리포트 — 관리자용 (ADR-0011) */
export function paidOrdersDailyReportEmail(args: {
  dateLabel: string;
  orders: Array<{
    orderCode: string;
    appName: string;
    testerCount: number;
    status: string;
    dayN: number | null;
    activeMatches: number;
    checkedInToday: number;
  }>;
  autoCanceledCount: number;
  yearlyPaidCount: number;
  /** 사람이 처리해야 할 일 — 있으면 제목에 [ACTION] */
  alerts?: string[];
}): Email {
  const alerts = args.alerts ?? [];
  const subject = `${alerts.length > 0 ? "[ACTION] " : ""}[Tester Match] 유료 테스터 일일 리포트 ${args.dateLabel} — 진행 ${args.orders.length}건${alerts.length > 0 ? ` · 처리 필요 ${alerts.length}건` : ""}`;
  const alertsHtml =
    alerts.length === 0
      ? ""
      : `<div style="margin:0 0 16px;padding:12px 14px;border:1px solid #fca5a5;background:#fef2f2;border-radius:10px;font-size:13px;line-height:1.6;color:#991b1b;">
        <strong>처리 필요</strong>
        <ul style="margin:8px 0 0;padding-left:18px;">${alerts.map((a) => `<li>${escapeHtml(a)}</li>`).join("")}</ul>
      </div>`;
  const rows = args.orders
    .map(
      (o) => `
      <tr>
        <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;"><strong>${escapeHtml(o.appName)}</strong><br>
          <span style="font-size:12px;color:#94a3b8;">${o.orderCode}</span></td>
        <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;text-align:center;">${o.status}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;text-align:center;">${o.dayN === null ? "-" : `${o.dayN}일째`}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;text-align:center;">${o.activeMatches}/${o.testerCount}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;text-align:center;">${o.checkedInToday}</td>
      </tr>`,
    )
    .join("");
  const tableHtml =
    args.orders.length === 0
      ? `<p style="margin:0 0 16px;color:#64748b;">진행 중인 유료 주문이 없습니다.</p>`
      : `
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
      <tr style="color:#64748b;text-align:center;">
        <th style="padding:6px;text-align:left;">주문</th><th>상태</th><th>결제 후</th><th>충원/시트</th><th>오늘 체크인</th>
      </tr>
      ${rows}
    </table>`;
  const html = layoutHtml(`
    <p style="margin:0 0 16px;font-weight:700;">유료 테스터 일일 리포트 — ${args.dateLabel}</p>
    ${alertsHtml}
    ${tableHtml}
    <p style="margin:0 0 8px;font-size:13px;color:#64748b;">
      미결제 24시간 경과 자동 취소: ${args.autoCanceledCount}건
    </p>
    <p style="margin:0 0 16px;font-size:13px;color:#64748b;">
      올해 누적 결제 ${args.yearlyPaidCount}건 — 연 50건 도달 전 통신판매업 신고 필요 (ADR-0011)
    </p>
    <p style="margin:24px 0 0;">
      <a href="${APP_URL}/admin/paid-orders"
         style="display:inline-block;background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;">
        주문 관리 열기
      </a>
    </p>
  `);
  const text = [
    `유료 테스터 일일 리포트 ${args.dateLabel}`,
    ...alerts.map((a) => `[처리 필요] ${a}`),
    ...args.orders.map(
      (o) =>
        `- ${o.appName} [${o.status}] ${o.dayN === null ? "-" : `D+${o.dayN}/14`} 투입 ${o.activeMatches}/${o.testerCount} 오늘 체크인 ${o.checkedInToday}`,
    ),
    `자동 취소 ${args.autoCanceledCount}건 / 올해 누적 결제 ${args.yearlyPaidCount}건`,
    `${APP_URL}/admin/paid-orders`,
  ].join("\n");
  return { subject, html, text };
}

/** 보상 교환 신청(기프티콘·네이버페이 포인트) — 관리자 알림 (ADR-0012, ADR-0017) */
export function redemptionRequestedEmail(args: {
  redemptionId: number;
  nickname: string;
  email: string;
  /** 보상 종류 이름 (기프티콘 / 네이버페이 포인트) */
  kindLabel: string;
  amount: number;
  contact: string;
  note: string;
}): Email {
  const amount = args.amount.toLocaleString("ko-KR");
  const kind = escapeHtml(args.kindLabel);
  const subject = `[Tester Match] ${args.kindLabel} 교환 신청 — ${args.nickname} ${amount} 크레딧`;
  const html = layoutHtml(`
    <p style="margin:0 0 16px;font-weight:700;">보상 교환 신청이 들어왔습니다.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
      <tr><td style="padding:6px 0;color:#64748b;">보상</td><td><strong>${kind}</strong></td></tr>
      <tr><td style="padding:6px 0;color:#64748b;">신청자</td><td>${escapeHtml(args.nickname)} (${escapeHtml(args.email)})</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;">금액</td><td><strong>${amount} 크레딧</strong></td></tr>
      <tr><td style="padding:6px 0;color:#64748b;">수신 연락처</td><td>${escapeHtml(args.contact)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;">메모</td><td>${escapeHtml(args.note || "-")}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;">신청번호</td><td>#${args.redemptionId}</td></tr>
    </table>
    <p style="margin:24px 0 0;">
      <a href="${APP_URL}/admin/redemptions"
         style="display:inline-block;background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;">
        교환 처리하기
      </a>
    </p>
  `);
  const text = `${args.kindLabel} 교환 신청 #${args.redemptionId} — ${args.nickname}(${args.email}) ${amount} 크레딧 / 연락처 ${args.contact} / ${args.note || "-"}\n${APP_URL}/admin/redemptions`;
  return { subject, html, text };
}

/** 유료 시트 보상 이의 제기 — 관리자 알림 (ADR-0012 부록 A) */
export function seatRewardDisputedEmail(args: {
  rewardId: number;
  orderId: number;
  amount: number;
  reason: string;
}): Email {
  const amount = args.amount.toLocaleString("ko-KR");
  const subject = `[Tester Match] 시트 보상 이의 제기 — 주문 #${args.orderId} (${amount} 크레딧)`;
  const html = layoutHtml(`
    <p style="margin:0 0 16px;font-weight:700;">구매자가 시트 보상에 이의를 제기했습니다.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
      <tr><td style="padding:6px 0;color:#64748b;">보상</td><td>#${args.rewardId} · ${amount} 크레딧</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;">사유</td><td>${escapeHtml(args.reason)}</td></tr>
    </table>
    <p style="margin:0 0 16px;font-size:13px;color:#64748b;">
      콘솔에서 해당 시트의 스크린샷 증빙을 확인한 뒤 지급 또는 몰수를 결정하세요.
    </p>
    <p style="margin:24px 0 0;">
      <a href="${APP_URL}/admin/seat-rewards"
         style="display:inline-block;background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;">
        이의 검토하기
      </a>
    </p>
  `);
  const text = `시트 보상 이의 제기 — 보상 #${args.rewardId} 주문 #${args.orderId} ${amount} 크레딧\n사유: ${args.reason}\n${APP_URL}/admin/seat-rewards`;
  return { subject, html, text };
}

/** 이메일 회원가입 인증 메일 (ADR-0013) */
export function signupVerifyEmail(args: { link: string }): Email {
  const subject = "[Tester Match] 이메일 인증을 완료해주세요";
  const html = layoutHtml(
    `
    <p style="margin:0 0 12px;">Tester Match 가입을 신청하셨습니다.</p>
    <p style="margin:0 0 16px;">아래 버튼을 누른 뒤, 열리는 화면에서 <strong>닉네임과 비밀번호를 정하면</strong> 가입이 완료됩니다.</p>
    <p style="margin:24px 0 0;">
      <a href="${args.link}"
         style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
        이메일 인증하기
      </a>
    </p>
    <p style="margin:20px 0 0;font-size:13px;color:#64748b;">
      버튼이 동작하지 않으면 아래 주소를 브라우저에 붙여넣어 주세요.<br>
      <span style="word-break:break-all;">${args.link}</span>
    </p>
    `,
    "본인이 가입을 신청하지 않았다면 이 메일을 무시해주세요. 버튼을 누르지 않으면 계정은 만들어지지 않습니다.",
  );
  const text = `Tester Match 가입을 신청하셨습니다. 아래 링크를 연 뒤 화면에서 닉네임과 비밀번호를 정하면 가입이 완료됩니다.\n${args.link}`;
  return { subject, html, text };
}

/** 문의 답변 안내 — 작성자 본인에게만 발송 */
export function inquiryAnsweredEmail(args: {
  nickname: string;
  inquiryId: number;
  title: string;
  answer: string;
}): Email {
  const link = `${APP_URL}/inquiries/${args.inquiryId}`;
  const subject = `[Tester Match] 문의에 답변이 등록되었습니다`;
  const html = layoutHtml(`
    <p style="margin:0 0 12px;"><strong>${escapeHtml(args.nickname)}</strong> 님,</p>
    <p style="margin:0 0 16px;">남겨주신 문의 <strong>${escapeHtml(args.title)}</strong> 에 답변이 등록되었습니다.</p>
    <div style="margin:0 0 16px;padding:14px 16px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;white-space:pre-wrap;">${escapeHtml(args.answer)}</div>
    <p style="margin:24px 0 0;">
      <a href="${link}"
         style="display:inline-block;background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;">
        문의 내역 보기
      </a>
    </p>
  `);
  const text = `${args.nickname} 님, 문의 "${args.title}" 에 답변이 등록되었습니다.\n\n${args.answer}\n\n${link}`;
  return { subject, html, text };
}
