import { describe, expect, it, afterEach } from "vitest";
import { verifyCronAuth } from "./cron-auth";

const make = (header?: string) =>
  new Request("http://localhost/api/cron", {
    headers: header ? { authorization: header } : {},
  });

describe("verifyCronAuth", () => {
  const original = process.env.CRON_SECRET;
  afterEach(() => {
    process.env.CRON_SECRET = original;
  });

  it("passes when CRON_SECRET is unset (dev/local)", () => {
    delete process.env.CRON_SECRET;
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
