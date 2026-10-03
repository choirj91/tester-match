/**
 * 이메일 발송 — Resend API 직접 호출 (edge runtime 호환).
 * RESEND_API_KEY 가 없으면 콘솔에만 로그 (개발/CI 환경 graceful no-op).
 *
 * 향후: 일일 한도 100/일 도달 시 BREVO_API_KEY fallback 추가 예정.
 */

export type SendEmailArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export type SendEmailResult =
  | { ok: true; id: string }
  | {
      ok: false;
      reason: "no_api_key" | "http_error" | "exception" | "undeliverable";
      detail?: string;
    };

const RESEND_API = "https://api.resend.com/emails";

/**
 * 받을 수 없는 주소 — 탈퇴 익명화(@deleted.local), 봉인된 사전등록 행(.invalid),
 * 도메인이 없는 값. 반송이 쌓이면 발신 도메인 평판이 떨어지므로 아예 보내지 않는다.
 */
export function isUndeliverableAddress(to: string): boolean {
  const address = to.trim().toLowerCase();
  return (
    !address.includes("@") || address.endsWith("@deleted.local") || address.endsWith(".invalid")
  );
}

/**
 * 운영 알림 수신 주소. Resend 도메인 검증 전에는 계정 소유자 주소로만 발송되므로
 * ADMIN_NOTIFY_EMAIL 로 일시 우회, 검증 후 제거하면 CONTACT_EMAIL 로 돌아간다.
 */
export function getAdminNotifyEmail(fallback: string): string {
  return process.env.ADMIN_NOTIFY_EMAIL || fallback;
}

export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  if (isUndeliverableAddress(args.to)) return { ok: false, reason: "undeliverable" };

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? "Tester Match <noreply@testermatch.local>";

  if (!apiKey) {
    console.log("[email] (no RESEND_API_KEY) would send:", {
      to: args.to,
      subject: args.subject,
    });
    return { ok: false, reason: "no_api_key" };
  }

  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: args.to,
        subject: args.subject,
        html: args.html,
        text: args.text,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[email] HTTP", res.status, detail);
      return { ok: false, reason: "http_error", detail: `${res.status}` };
    }

    const data = (await res.json()) as { id: string };
    return { ok: true, id: data.id };
  } catch (err) {
    console.error("[email] exception", err);
    return { ok: false, reason: "exception", detail: String(err) };
  }
}
