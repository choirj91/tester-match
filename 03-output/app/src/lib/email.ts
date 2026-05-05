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
  | { ok: false; reason: "no_api_key" | "http_error" | "exception"; detail?: string };

const RESEND_API = "https://api.resend.com/emails";

export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
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
