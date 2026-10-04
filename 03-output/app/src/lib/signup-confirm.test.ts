import { describe, expect, test } from "vitest";
import {
  buildConfirmUrl,
  confirmResultPath,
  isPreRegisteredRow,
  isSameOriginRequest,
  isValidTokenHash,
  randomPassword,
} from "./signup-confirm";

const TOKEN = "a".repeat(56);

describe("isValidTokenHash", () => {
  test("accepts the hex token GoTrue issues", () => {
    expect(isValidTokenHash(TOKEN)).toBe(true);
  });

  test("accepts a pkce-prefixed token", () => {
    expect(isValidTokenHash(`pkce_${TOKEN}`)).toBe(true);
  });

  test("rejects missing, short, and non-hex values", () => {
    expect(isValidTokenHash(undefined)).toBe(false);
    expect(isValidTokenHash(null)).toBe(false);
    expect(isValidTokenHash("")).toBe(false);
    expect(isValidTokenHash("abc123")).toBe(false);
    expect(isValidTokenHash(`${TOKEN}"><script>`)).toBe(false);
    expect(isValidTokenHash("z".repeat(56))).toBe(false);
  });
});

describe("buildConfirmUrl", () => {
  test("points at our own confirm endpoint, not the auth provider", () => {
    const url = buildConfirmUrl("https://tester-match.knockknock.company", TOKEN);
    expect(url).toBe(
      `https://tester-match.knockknock.company/api/auth/confirm?token_hash=${TOKEN}`,
    );
  });
});

describe("isPreRegisteredRow", () => {
  const signedUpAt = "2026-10-03T15:17:28.149Z";

  test("a row created months before the login is pre-registered", () => {
    expect(isPreRegisteredRow("2026-05-05T13:55:00.556Z", signedUpAt)).toBe(true);
  });

  test("a row created at confirmation time is not pre-registered", () => {
    expect(isPreRegisteredRow("2026-10-03T15:17:38.694Z", signedUpAt)).toBe(false);
  });

  test("clock skew of a few seconds around signup does not count", () => {
    expect(isPreRegisteredRow("2026-10-03T15:17:20.000Z", signedUpAt)).toBe(false);
  });

  test("unparseable timestamps are treated as pre-registered (fail safe: never delete)", () => {
    expect(isPreRegisteredRow("not-a-date", signedUpAt)).toBe(true);
  });
});

describe("isSameOriginRequest", () => {
  const url = "https://tester-match.knockknock.company/api/auth/confirm";

  test("accepts a form posted from our own origin", () => {
    const headers = new Headers({ origin: "https://tester-match.knockknock.company" });
    expect(isSameOriginRequest(url, headers)).toBe(true);
  });

  test("rejects another site and a sibling subdomain", () => {
    expect(isSameOriginRequest(url, new Headers({ origin: "https://evil.example" }))).toBe(false);
    expect(
      isSameOriginRequest(url, new Headers({ origin: "https://other.knockknock.company" })),
    ).toBe(false);
  });

  test("without an Origin header falls back to the browser's fetch metadata", () => {
    expect(isSameOriginRequest(url, new Headers({ "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(isSameOriginRequest(url, new Headers({ "sec-fetch-site": "same-site" }))).toBe(false);
    expect(isSameOriginRequest(url, new Headers({ "sec-fetch-site": "cross-site" }))).toBe(false);
  });

  test("rejects a request that carries neither header", () => {
    expect(isSameOriginRequest(url, new Headers())).toBe(false);
  });
});

describe("randomPassword", () => {
  test("is long, within the 72-character limit, and different every time", () => {
    const a = randomPassword();
    const b = randomPassword();
    expect(a.length).toBeGreaterThanOrEqual(40);
    expect(a.length).toBeLessThanOrEqual(72);
    expect(a).not.toBe(b);
  });
});

describe("confirmResultPath", () => {
  test("a bad or used link goes back to login with an error code", () => {
    expect(confirmResultPath({ ok: false, reason: "link" })).toBe(
      "/auth/login?error=confirm_failed",
    );
  });

  test("a password that could not be saved has its own error code", () => {
    expect(confirmResultPath({ ok: false, reason: "password" })).toBe(
      "/auth/login?error=confirm_password_failed",
    );
  });

  test("a confirmed login that ended up without a member row has its own error code", () => {
    expect(confirmResultPath({ ok: false, reason: "member" })).toBe(
      "/auth/login?error=confirm_member_failed",
    );
  });

  test("success goes to login with the verified notice", () => {
    expect(confirmResultPath({ ok: true })).toBe("/auth/login?verified=1");
  });
});
