import { describe, expect, it } from "vitest";
import { isGoogleGroupUrl, isPlayStoreUrl } from "./play-url";

describe("isPlayStoreUrl", () => {
  it.each([
    "https://play.google.com/apps/testing/com.example.app",
    "https://play.google.com/store/apps/details?id=com.example.app",
    "https://play.google.com/apps/internaltest/4701597199929333620",
    "  https://play.google.com/apps/testing/com.example.app  ",
    "https://PLAY.GOOGLE.COM/apps/testing/com.example.app",
  ])("accepts a real Google Play link: %s", (url) => {
    expect(isPlayStoreUrl(url)).toBe(true);
  });

  it.each([
    ["play.google.com only in the query", "https://evil.example/?play.google.com"],
    ["play.google.com only in the path", "https://evil.example/play.google.com/apps/testing/x"],
    ["play.google.com only in the fragment", "https://evil.example/#play.google.com"],
    ["look-alike subdomain", "https://play.google.com.evil.example/apps/testing/x"],
    ["credentials before the host", "https://play.google.com@evil.example/apps/testing/x"],
    ["user info on the real host", "https://user:pw@play.google.com/apps/testing/x"],
    ["plain http", "http://play.google.com/apps/testing/x"],
    ["typo scheme", "ttps://play.google.com/apps/internaltest/1"],
    ["javascript scheme", "javascript:alert(1)//play.google.com"],
    ["other google host", "https://groups.google.com/g/play.google.com"],
    ["not a url", "play.google.com/apps/testing/x"],
    ["empty", ""],
  ])("rejects %s", (_label, url) => {
    expect(isPlayStoreUrl(url)).toBe(false);
  });

  it("rejects null and undefined", () => {
    expect(isPlayStoreUrl(null)).toBe(false);
    expect(isPlayStoreUrl(undefined)).toBe(false);
  });
});

describe("isGoogleGroupUrl", () => {
  it.each([
    "https://groups.google.com/a/knockknock.company/g/testers",
    "https://groups.google.com/g/paletta-testers",
  ])("accepts a Google Groups link: %s", (url) => {
    expect(isGoogleGroupUrl(url)).toBe(true);
  });

  it.each([
    ["a web app on another host", "https://example.vercel.app/"],
    ["a Play link in the group field", "https://play.google.com/apps/testing/com.example.app"],
    ["look-alike subdomain", "https://groups.google.com.evil.example/g/x"],
    ["plain http", "http://groups.google.com/villaparking-test"],
  ])("rejects %s", (_label, url) => {
    expect(isGoogleGroupUrl(url)).toBe(false);
  });
});
