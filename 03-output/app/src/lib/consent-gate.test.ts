import { describe, expect, test } from "vitest";
import { consentNextPath, consentPagePath, isConsentGated } from "./consent-gate";

const ORIGIN = "https://tester-match.knockknock.company";

describe("isConsentGated", () => {
  test.each([
    ["/", true],
    ["/apps/12?tab=log", true],
    ["/profile", true],
    ["/authors", true],
    ["/api/profile", false],
    ["/api", false],
    ["/auth/consent", false],
    ["/auth/login?next=/apps", false],
    ["/auth", false],
    ["/policies", false],
    ["/policies/terms?version=2026-11-28", false],
  ])("%s → %s", (path, gated) => {
    expect(isConsentGated(path)).toBe(gated);
  });
});

describe("consentNextPath", () => {
  test("사이트 안 경로는 그대로", () => {
    expect(consentNextPath("/apps/3?x=1", ORIGIN)).toBe("/apps/3?x=1");
  });
  test("밖으로 나가는 주소는 홈", () => {
    expect(consentNextPath("//evil.example", ORIGIN)).toBe("/");
    expect(consentNextPath("https://evil.example/", ORIGIN)).toBe("/");
  });
  test("동의 화면 자신·없는 값은 홈 (무한 이동 방지)", () => {
    expect(consentNextPath("/auth/consent?next=/auth/consent", ORIGIN)).toBe("/");
    expect(consentNextPath(null, ORIGIN)).toBe("/");
  });
});

test("consentPagePath", () => {
  expect(consentPagePath("/apps/3?x=1")).toBe("/auth/consent?next=%2Fapps%2F3%3Fx%3D1");
  expect(consentPagePath("/", "save")).toBe("/auth/consent?next=%2F&error=save");
});
