import { describe, expect, test } from "vitest";
import {
  SIGNUP_LIMIT_GLOBAL_PER_HOUR,
  SIGNUP_LIMIT_PER_IP_PER_HOUR,
  clientIp,
  signupVerdict,
} from "./signup-guard";

describe("signupVerdict", () => {
  test("한도 미만이면 통과", () => {
    expect(signupVerdict(0, 0)).toBe("ok");
    expect(signupVerdict(SIGNUP_LIMIT_PER_IP_PER_HOUR - 1, 10)).toBe("ok");
  });

  test("IP 한도에 도달하면 차단", () => {
    expect(signupVerdict(SIGNUP_LIMIT_PER_IP_PER_HOUR, 0)).toBe("ip_limited");
  });

  test("전체 한도에 도달하면 차단", () => {
    expect(signupVerdict(0, SIGNUP_LIMIT_GLOBAL_PER_HOUR)).toBe("global_limited");
  });
});

describe("clientIp", () => {
  test("App Service 가 덧붙인 마지막 X-Forwarded-For 항목을 쓴다", () => {
    const req = new Request("https://example.com", {
      headers: { "cf-connecting-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9, 5.6.7.8:51234" },
    });
    expect(clientIp(req)).toBe("5.6.7.8");
  });

  test("헤더가 없으면 unknown", () => {
    expect(clientIp(new Request("https://example.com"))).toBe("unknown");
  });
});
