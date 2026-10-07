import { describe, expect, test } from "vitest";
import { normalizeKoreanMobile } from "./phone";

describe("normalizeKoreanMobile", () => {
  test.each([
    ["010-1234-5678", "01012345678"],
    ["010 1234 5678", "01012345678"],
    ["01012345678", "01012345678"],
    ["011-123-4567", "0111234567"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeKoreanMobile(input)).toBe(expected);
  });

  test.each(["", "02-123-4567", "010-12-5678", "+82 10 1234 5678", "010-1234-56789", "abc"])(
    "%j 는 휴대폰 번호가 아니다",
    (input) => {
      expect(normalizeKoreanMobile(input)).toBeNull();
    },
  );
});
