import { describe, expect, it, afterEach, vi } from "vitest";
import { verifyCronAuth } from "./cron-auth";

const make = (header?: string) =>
  new Request("http://localhost/api/cron", {
    headers: header ? { authorization: header } : {},
  });

describe("verifyCronAuth", () => {
  const original = process.env.CRON_SECRET;
  afterEach(() => {
    process.env.CRON_SECRET = original;
    vi.unstubAllEnvs();
  });

  it("passes when CRON_SECRET is unset under the test runner", () => {
    delete process.env.CRON_SECRET;
    expect(verifyCronAuth(make())).toBe(true);
  });

  it("rejects when CRON_SECRET is unset outside tests (fail closed)", () => {
    delete process.env.CRON_SECRET;
    vi.stubEnv("NODE_ENV", "production");
    expect(verifyCronAuth(make())).toBe(false);
    vi.stubEnv("NODE_ENV", "development");
    expect(verifyCronAuth(make())).toBe(false);
  });

  it("passes without a secret only when explicitly allowed", () => {
    delete process.env.CRON_SECRET;
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("CRON_ALLOW_UNAUTHENTICATED", "1");
    expect(verifyCronAuth(make())).toBe(true);
  });

  it("rejects mismatch when CRON_SECRET is set", () => {
    process.env.CRON_SECRET = "topsecret";
    expect(verifyCronAuth(make())).toBe(false);
    expect(verifyCronAuth(make("Bearer wrong"))).toBe(false);
  });

  it("accepts matching Bearer when CRON_SECRET is set", () => {
    process.env.CRON_SECRET = "topsecret";
    expect(verifyCronAuth(make("Bearer topsecret"))).toBe(true);
  });
});
