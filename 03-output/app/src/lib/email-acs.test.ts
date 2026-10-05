import { createHash, createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseAcsConnectionString,
  senderAddressOf,
  sendViaAcs,
  signAcsRequest,
} from "./email-acs";
import { sendEmail } from "./email";

const KEY = Buffer.from("test-access-key-0123456789").toString("base64");
const CONN = `endpoint=https://acs-test.korea.communication.azure.com/;accesskey=${KEY}`;

describe("parseAcsConnectionString", () => {
  it("reads endpoint and access key regardless of key case", () => {
    const creds = parseAcsConnectionString(`Endpoint=https://a.communication.azure.com/;AccessKey=${KEY}`);
    expect(creds?.endpoint.host).toBe("a.communication.azure.com");
    expect(creds?.accessKey).toBe(KEY);
  });

  it("keeps '=' padding inside the access key", () => {
    expect(parseAcsConnectionString("endpoint=https://a.b/;accesskey=abc==")?.accessKey).toBe("abc==");
  });

  it("returns null when a part is missing or the endpoint is not a URL", () => {
    expect(parseAcsConnectionString("endpoint=https://a.b/")).toBeNull();
    expect(parseAcsConnectionString(`endpoint=not a url;accesskey=${KEY}`)).toBeNull();
  });
});

describe("senderAddressOf", () => {
  it("extracts the address from a display-name form", () => {
    expect(senderAddressOf("Tester Match <noreply@knockknock.company>")).toBe("noreply@knockknock.company");
    expect(senderAddressOf(" noreply@knockknock.company ")).toBe("noreply@knockknock.company");
  });
});

describe("signAcsRequest", () => {
  it("signs method, path+query, date, host and body hash with the decoded key", () => {
    // Arrange
    const url = new URL("https://acs-test.korea.communication.azure.com/emails:send?api-version=2023-03-31");
    const body = '{"a":1}';
    const date = new Date("2026-10-05T05:00:00Z");

    // Act
    const headers = signAcsRequest({ method: "POST", url, body, accessKey: KEY, date });

    // Assert
    const hash = createHash("sha256").update(body).digest("base64");
    const toSign = `POST\n/emails:send?api-version=2023-03-31\nMon, 05 Oct 2026 05:00:00 GMT;acs-test.korea.communication.azure.com;${hash}`;
    const sig = createHmac("sha256", Buffer.from(KEY, "base64")).update(toSign).digest("base64");
    expect(headers["x-ms-date"]).toBe("Mon, 05 Oct 2026 05:00:00 GMT");
    expect(headers["x-ms-content-sha256"]).toBe(hash);
    expect(headers.Authorization).toBe(
      `HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${sig}`,
    );
  });
});

describe("sendViaAcs", () => {
  afterEach(() => vi.restoreAllMocks());

  it("posts the message to emails:send and returns the operation id on 202", async () => {
    // Arrange
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "op-1", status: "Running" }), { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    const creds = parseAcsConnectionString(CONN)!;

    // Act
    const r = await sendViaAcs(creds, {
      from: "Tester Match <noreply@knockknock.company>",
      to: "user@example.com",
      subject: "제목",
      html: "<p>본문</p>",
      text: "본문",
    });

    // Assert
    expect(r).toEqual({ ok: true, id: "op-1" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe("https://acs-test.korea.communication.azure.com/emails:send?api-version=2023-03-31");
    expect(JSON.parse(String(init.body))).toEqual({
      senderAddress: "noreply@knockknock.company",
      recipients: { to: [{ address: "user@example.com" }] },
      content: { subject: "제목", html: "<p>본문</p>", plainText: "본문" },
    });
    expect((init.headers as Record<string, string>).Authorization).toMatch(/^HMAC-SHA256 /);
  });

  it("returns http_error with the status on non-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("denied", { status: 401 })));
    const r = await sendViaAcs(parseAcsConnectionString(CONN)!, {
      from: "noreply@knockknock.company",
      to: "user@example.com",
      subject: "s",
      html: "h",
    });
    expect(r).toEqual({ ok: false, reason: "http_error", detail: "401" });
  });
});

describe("sendEmail provider choice", () => {
  const saved = { acs: process.env.ACS_CONNECTION_STRING, resend: process.env.RESEND_API_KEY };
  afterEach(() => {
    process.env.ACS_CONNECTION_STRING = saved.acs;
    process.env.RESEND_API_KEY = saved.resend;
    if (saved.acs === undefined) delete process.env.ACS_CONNECTION_STRING;
    if (saved.resend === undefined) delete process.env.RESEND_API_KEY;
    vi.restoreAllMocks();
  });

  it("uses ACS when ACS_CONNECTION_STRING is set, even with a Resend key", async () => {
    process.env.ACS_CONNECTION_STRING = CONN;
    process.env.RESEND_API_KEY = "re_test";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "op-2" }), { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);

    const r = await sendEmail({ to: "user@example.com", subject: "s", html: "h" });

    expect(r).toEqual({ ok: true, id: "op-2" });
    expect(String((fetchMock.mock.calls[0] as unknown as [URL])[0])).toContain("communication.azure.com");
  });

  it("falls back to Resend when the ACS connection string is malformed", async () => {
    process.env.ACS_CONNECTION_STRING = "garbage";
    process.env.RESEND_API_KEY = "re_test";
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "re-1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const r = await sendEmail({ to: "user@example.com", subject: "s", html: "h" });

    expect(r).toEqual({ ok: true, id: "re-1" });
    expect(String((fetchMock.mock.calls[0] as unknown as [string])[0])).toBe("https://api.resend.com/emails");
  });
});
