import { describe, expect, test } from "vitest";
import { safeInternalPath } from "./safe-redirect";

const ORIGIN = "https://tester-match.knockknock.company";

describe("safeInternalPath", () => {
  test("keeps an internal path with its query and hash", () => {
    expect(safeInternalPath("/board/1/edit?tab=a#top", ORIGIN)).toBe("/board/1/edit?tab=a#top");
  });

  test("falls back to the home page when nothing is given", () => {
    expect(safeInternalPath(null, ORIGIN)).toBe("/");
    expect(safeInternalPath(undefined, ORIGIN)).toBe("/");
    expect(safeInternalPath("", ORIGIN)).toBe("/");
  });

  test("rejects absolute and protocol-relative URLs", () => {
    expect(safeInternalPath("https://evil.example", ORIGIN)).toBe("/");
    expect(safeInternalPath("//evil.example", ORIGIN)).toBe("/");
  });

  test("rejects backslash and control-character tricks browsers normalise to //", () => {
    expect(safeInternalPath("/\\evil.example", ORIGIN)).toBe("/");
    expect(safeInternalPath("/\t/evil.example", ORIGIN)).toBe("/");
    expect(safeInternalPath("/\n/evil.example", ORIGIN)).toBe("/");
  });

  test("rejects paths the URL parser normalises into a protocol-relative URL", () => {
    expect(safeInternalPath("/.//evil.example", ORIGIN)).toBe("/");
    expect(safeInternalPath("/a/..//evil.example", ORIGIN)).toBe("/");
    expect(safeInternalPath("/%2e//evil.example", ORIGIN)).toBe("/");
  });

  test("rejects values that would extend the host when appended to the origin", () => {
    expect(safeInternalPath(".evil.example", ORIGIN)).toBe("/");
    expect(safeInternalPath("@evil.example", ORIGIN)).toBe("/");
  });
});
