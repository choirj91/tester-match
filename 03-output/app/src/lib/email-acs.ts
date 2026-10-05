/**
 * Azure Communication Services Email — REST 직접 호출 (SDK 없이 HMAC-SHA256 서명).
 * ACS_CONNECTION_STRING("endpoint=https://<name>.communication.azure.com/;accesskey=<base64>")
 * 이 있으면 sendEmail 이 Resend 대신 이 경로를 쓴다 (ADR-0015 3-1).
 *
 * 서명 규격: https://learn.microsoft.com/azure/communication-services/tutorials/hmac-header-tutorial
 */

import { createHash, createHmac } from "node:crypto";

export const ACS_EMAIL_API_VERSION = "2023-03-31";

export type AcsCredentials = { endpoint: URL; accessKey: string };

export function parseAcsConnectionString(raw: string): AcsCredentials | null {
  const parts = new Map<string, string>();
  for (const segment of raw.split(";")) {
    const eq = segment.indexOf("=");
    if (eq <= 0) continue;
    parts.set(segment.slice(0, eq).trim().toLowerCase(), segment.slice(eq + 1).trim());
  }
  const endpoint = parts.get("endpoint");
  const accessKey = parts.get("accesskey");
  if (!endpoint || !accessKey) return null;
  try {
    return { endpoint: new URL(endpoint), accessKey };
  } catch {
    return null;
  }
}

/** "Tester Match <noreply@x.com>" 또는 "noreply@x.com" → 주소만. */
export function senderAddressOf(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return (match ? match[1] : from).trim();
}

/** 요청 헤더(x-ms-date, x-ms-content-sha256, Authorization) 생성. */
export function signAcsRequest(args: {
  method: string;
  url: URL;
  body: string;
  accessKey: string;
  date: Date;
}): Record<string, string> {
  const contentHash = createHash("sha256").update(args.body, "utf8").digest("base64");
  const msDate = args.date.toUTCString();
  const stringToSign = `${args.method}\n${args.url.pathname}${args.url.search}\n${msDate};${args.url.host};${contentHash}`;
  const signature = createHmac("sha256", Buffer.from(args.accessKey, "base64"))
    .update(stringToSign, "utf8")
    .digest("base64");
  return {
    "x-ms-date": msDate,
    "x-ms-content-sha256": contentHash,
    Authorization: `HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${signature}`,
  };
}

export type AcsSendResult =
  | { ok: true; id: string }
  | { ok: false; reason: "http_error" | "exception"; detail?: string };

export async function sendViaAcs(
  creds: AcsCredentials,
  message: { from: string; to: string; subject: string; html: string; text?: string },
  now: Date = new Date(),
): Promise<AcsSendResult> {
  const url = new URL(`/emails:send?api-version=${ACS_EMAIL_API_VERSION}`, creds.endpoint);
  const body = JSON.stringify({
    senderAddress: senderAddressOf(message.from),
    recipients: { to: [{ address: message.to }] },
    content: {
      subject: message.subject,
      html: message.html,
      ...(message.text ? { plainText: message.text } : {}),
    },
  });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...signAcsRequest({ method: "POST", url, body, accessKey: creds.accessKey, date: now }),
      },
      body,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[email/acs] HTTP", res.status, detail);
      return { ok: false, reason: "http_error", detail: `${res.status}` };
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: data.id ?? res.headers.get("operation-id") ?? "" };
  } catch (err) {
    console.error("[email/acs] exception", err);
    return { ok: false, reason: "exception", detail: String(err) };
  }
}
