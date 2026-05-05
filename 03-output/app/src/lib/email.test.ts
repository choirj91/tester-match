import { describe, expect, it, vi, afterEach } from "vitest";
import { sendEmail } from "./email";

describe("sendEmail", () => {
  const originalKey = process.env.RESEND_API_KEY;

  afterEach(() => {
    process.env.RESEND_API_KEY = originalKey;
    vi.restoreAllMocks();
  });

  it("returns no_api_key when RESEND_API_KEY is missing", async () => {
    delete process.env.RESEND_API_KEY;
    const r = await sendEmail({
      to: "x@example.com",
      subject: "hi",
      html: "<p>hi</p>",
    });
    expect(r).toEqual({ ok: false, reason: "no_api_key" });
  });

  it("returns http_error when API responds non-2xx", async () => {
    process.env.RESEND_API_KEY = "test_key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 422,
        text: async () => "validation",
      })),
    );
    const r = await sendEmail({
      to: "x@example.com",
      subject: "hi",
      html: "<p>hi</p>",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("http_error");
      expect(r.detail).toBe("422");
    }
  });

  it("returns ok with id on success", async () => {
    process.env.RESEND_API_KEY = "test_key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ id: "abc-123" }),
      })),
    );
    const r = await sendEmail({
      to: "x@example.com",
      subject: "hi",
      html: "<p>hi</p>",
    });
    expect(r).toEqual({ ok: true, id: "abc-123" });
  });
});
