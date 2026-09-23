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
    <p style="margin:0 0 12px;"><strong>${args.ownerNickname}</strong> 님,</p>
    <p style="margin:0 0 16px;">
      등록한 앱 <strong>${args.appName}</strong> 에 테스터 한 명이 새로 참여했습니다.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
      <tr><td style="padding:6px 0;color:#64748b;">테스터</td><td>${args.testerNickname}</td></tr>
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
  apps: Array<{ name: string; appId: number; dayN: number }>;
}): Email {
  const list = args.apps
    .map(
      (a) =>
        `<li style="margin:6px 0;"><strong>${a.name}</strong> — ${a.dayN}일차</li>`,
    )
    .join("");
  const subject = `[Tester Match] 오늘 체크인할 앱 ${args.apps.length}개`;
  const html = layoutHtml(`
    <p style="margin:0 0 12px;"><strong>${args.testerNickname}</strong> 님,</p>
    <p style="margin:0 0 16px;">오늘 체크인이 필요한 앱 ${args.apps.length}개가 있습니다.</p>
    <ul style="margin:0 0 16px;padding-left:20px;">${list}</ul>
    <p style="margin:24px 0 0;">
      <a href="${APP_URL}/my-tests"
         style="display:inline-block;background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;">
        지금 체크인하기
      </a>
    </p>
    <p style="margin:16px 0 0;font-size:13px;color:#64748b;">
      체크인을 5일 연속 놓치면 페널티가 부과됩니다.
    </p>
  `);
  const text = `${args.testerNickname} 님, 오늘 체크인이 필요한 앱 ${args.apps.length}개:\n${args.apps.map((a) => `- ${a.name} (${a.dayN}일차)`).join("\n")}\n\n체크인: ${APP_URL}/my-tests`;
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
    <p style="margin:0 0 16px;"><strong>${args.recipientNickname}</strong> 님,</p>
    ${lines}
    <p style="margin:28px 0 0;">
      <a href="${APP_URL}/browse/${args.appId}"
         style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
        테스트 참여하기 →
      </a>
    </p>
    `,
    `이 메일은 Tester Match 회원 <strong>${args.senderNickname}</strong>님의 테스터 요청입니다. 원치 않으시면 무시하셔도 됩니다.`,
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
  const subject = `[Tester Match] 💰 유료 테스터 결제 — ${args.appName} ${args.testerCount}명 (${amount}원)`;
  const html = layoutHtml(`
    <p style="margin:0 0 16px;font-weight:700;">유료 테스터 주문이 결제되었습니다.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
      <tr><td style="padding:6px 0;color:#64748b;">앱</td><td><strong>${escapeHtml(args.appName)}</strong></td></tr>
      <tr><td style="padding:6px 0;color:#64748b;">구매자</td><td>${escapeHtml(args.buyerNickname)} (${escapeHtml(args.buyerEmail)})</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;">인원</td><td>${args.testerCount}명 × 1,000원</td></tr>
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
}): Email {
  const amount = args.amountKrw.toLocaleString("ko-KR");
  const subject = `[Tester Match] 유료 테스터 신청 완료 — ${args.appName}`;
  const html = layoutHtml(`
    <p style="margin:0 0 12px;"><strong>${escapeHtml(args.buyerNickname)}</strong> 님,</p>
    <p style="margin:0 0 16px;">
      <strong>${escapeHtml(args.appName)}</strong> 유료 테스터 신청이 완료되었습니다.
      운영팀 테스터가 곧 참여를 시작하고, 14일간 매일 실기기에서 체크인합니다.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
      <tr><td style="padding:6px 0;color:#64748b;">인원</td><td>${args.testerCount}명</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;">결제 금액</td><td>${amount}원</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;">주문번호</td><td>${args.orderCode}</td></tr>
    </table>
    <p style="margin:0 0 16px;font-size:13px;color:#64748b;">
      테스터 참여 현황은 앱 상세의 테스터 모니터링에서 실시간으로 확인할 수 있습니다.
      테스트 개시 전에는 전액 환불이 가능합니다.
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
}): Email {
  const subject = `[Tester Match] 유료 테스터 일일 리포트 ${args.dateLabel} — 진행 ${args.orders.length}건`;
  const rows = args.orders
    .map(
      (o) => `
      <tr>
        <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;"><strong>${escapeHtml(o.appName)}</strong><br>
          <span style="font-size:12px;color:#94a3b8;">${o.orderCode}</span></td>
        <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;text-align:center;">${o.status}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;text-align:center;">${o.dayN === null ? "-" : `D+${o.dayN}/14`}</td>
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
        <th style="padding:6px;text-align:left;">주문</th><th>상태</th><th>일차</th><th>투입/신청</th><th>오늘 체크인</th>
      </tr>
      ${rows}
    </table>`;
  const html = layoutHtml(`
    <p style="margin:0 0 16px;font-weight:700;">유료 테스터 일일 리포트 — ${args.dateLabel}</p>
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
    ...args.orders.map(
      (o) =>
        `- ${o.appName} [${o.status}] ${o.dayN === null ? "-" : `D+${o.dayN}/14`} 투입 ${o.activeMatches}/${o.testerCount} 오늘 체크인 ${o.checkedInToday}`,
    ),
    `자동 취소 ${args.autoCanceledCount}건 / 올해 누적 결제 ${args.yearlyPaidCount}건`,
    `${APP_URL}/admin/paid-orders`,
  ].join("\n");
  return { subject, html, text };
}

export function matchCompletedEmail(args: {
  testerNickname: string;
  appName: string;
  reward: number;
}): Email {
  const subject = `[Tester Match] "${args.appName}" 14일 완주! +${args.reward} 크레딧`;
  const html = layoutHtml(`
    <p style="margin:0 0 12px;"><strong>${args.testerNickname}</strong> 님,</p>
    <p style="margin:0 0 16px;">
      <strong>${args.appName}</strong> 14일 테스트를 무사히 완주하셨습니다. 🎉
    </p>
    <p style="margin:16px 0;">
      <strong>+${args.reward.toLocaleString("ko-KR")} 크레딧</strong> 적립이 완료되었습니다.
    </p>
    <p style="margin:24px 0 0;">
      <a href="${APP_URL}/credits"
         style="display:inline-block;background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;">
        크레딧 내역 보기
      </a>
    </p>
  `);
  const text = `${args.testerNickname} 님, "${args.appName}" 14일 완주! +${args.reward} 크레딧 적립됨.\n${APP_URL}/credits`;
  return { subject, html, text };
}
