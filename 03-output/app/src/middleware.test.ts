import { describe, expect, test } from "vitest";
import { isBlockedAuthPath } from "./middleware";

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
