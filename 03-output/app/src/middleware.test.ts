import { NextRequest } from "next/server";
import { describe, expect, test } from "vitest";
import { PATHNAME_HEADER } from "@/lib/consent-gate";
import { isBlockedAuthPath, middleware } from "./middleware";

describe("요청 경로 헤더 (약관 동의 확인용)", () => {
  test("경로와 쿼리를 넘기고, 브라우저가 보낸 같은 이름의 값은 덮어쓴다", () => {
    const req = new NextRequest("https://tester-match.knockknock.company/apps/3?tab=log", {
      headers: { [PATHNAME_HEADER]: "/api/spoofed" },
    });
    const res = middleware(req);
    expect(res.headers.get(`x-middleware-request-${PATHNAME_HEADER}`)).toBe("/apps/3?tab=log");
  });
});

describe("isBlockedAuthPath", () => {
  test.each([
    ["/auth/v1/signup", true],
    ["/auth/v1/signup/", true],
    ["/auth/v1/admin/users", true],
    ["/auth/v1/admin", true],
    ["/auth/v1/token", false],
    ["/auth/v1/authorize", false],
    ["/auth/v1/callback", false],
    ["/auth/v1/verify", false],
    ["/auth/v1/user", false],
    ["/auth/v1/signupx", false],
    ["/auth/signup", false],
    ["/auth/login", false],
  ])("%s → %s", (path, blocked) => {
    expect(isBlockedAuthPath(path)).toBe(blocked);
  });
});
