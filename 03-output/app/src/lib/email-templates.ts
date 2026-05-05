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
