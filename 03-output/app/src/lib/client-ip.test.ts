import { describe, expect, test } from "vitest";
import { clientIpFromHeaders, clientIpHeaderFromEnv, stripPort } from "./client-ip";

function headers(init: Record<string, string>): Headers {
  return new Headers(init);
}

describe("clientIpFromHeaders — x-forwarded-for (기본)", () => {
  test("클라이언트가 앞에 끼워 넣은 값은 무시하고 마지막 항목을 쓴다", () => {
    const h = headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.7:50211" });
    expect(clientIpFromHeaders(h, "x-forwarded-for")).toBe("203.0.113.7");
  });

  test("CF-Connecting-IP 는 지정하지 않으면 보지 않는다 (위조 가능)", () => {
    const h = headers({ "cf-connecting-ip": "1.1.1.1", "x-forwarded-for": "203.0.113.7" });
    expect(clientIpFromHeaders(h, "x-forwarded-for")).toBe("203.0.113.7");
  });

  test("IPv6 대괄호·포트를 벗긴다", () => {
    const h = headers({ "x-forwarded-for": "[2001:db8::1]:443" });
    expect(clientIpFromHeaders(h, "x-forwarded-for")).toBe("2001:db8::1");
  });

  test("헤더가 없거나 비어 있으면 null", () => {
    expect(clientIpFromHeaders(headers({}), "x-forwarded-for")).toBeNull();
    expect(
      clientIpFromHeaders(headers({ "x-forwarded-for": " , " }), "x-forwarded-for"),
    ).toBeNull();
  });
});

describe("clientIpFromHeaders — 앞단별 헤더", () => {
  test("cf-connecting-ip 를 지정하면 그 값을 쓰고 XFF 로 대체하지 않는다", () => {
    const h = headers({ "cf-connecting-ip": "198.51.100.4", "x-forwarded-for": "9.9.9.9" });
    expect(clientIpFromHeaders(h, "cf-connecting-ip")).toBe("198.51.100.4");
    expect(
      clientIpFromHeaders(headers({ "x-forwarded-for": "9.9.9.9" }), "cf-connecting-ip"),
    ).toBeNull();
  });

  test("x-azure-clientip (Front Door)", () => {
    const h = headers({
      "x-azure-clientip": "198.51.100.9",
      "x-forwarded-for": "9.9.9.9, 10.0.0.1",
    });
    expect(clientIpFromHeaders(h, "x-azure-clientip")).toBe("198.51.100.9");
  });
});

describe("stripPort", () => {
  test.each([
    ["1.2.3.4", "1.2.3.4"],
    ["1.2.3.4:8080", "1.2.3.4"],
    ["2001:db8::1", "2001:db8::1"],
    ["[2001:db8::1]", "2001:db8::1"],
    ["[2001:db8::1]:443", "2001:db8::1"],
  ])("%s → %s", (raw, expected) => {
    expect(stripPort(raw)).toBe(expected);
  });
});

describe("clientIpHeaderFromEnv", () => {
  test("비어 있으면 x-forwarded-for, 값은 소문자로", () => {
    expect(clientIpHeaderFromEnv(undefined)).toBe("x-forwarded-for");
    expect(clientIpHeaderFromEnv("  ")).toBe("x-forwarded-for");
    expect(clientIpHeaderFromEnv("CF-Connecting-IP")).toBe("cf-connecting-ip");
  });
});
