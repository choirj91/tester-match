// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { POLICY_BODIES } from "./bodies";
import {
  POLICY_VERSIONS,
  effectiveVersion,
  koreanDate,
  pendingPolicyKinds,
  upcomingVersion,
  versionsOf,
} from "./registry";

const POLICIES_DIR = path.resolve(__dirname);
const MIGRATIONS_DIR = path.resolve(__dirname, "../../../supabase/migrations");

describe("버전 목록과 원문 파일", () => {
  test.each(POLICY_VERSIONS.map((v) => [`${v.kind}/${v.version}`, v] as const))(
    "%s — 파일 해시가 목록과 같다 (시행된 원문은 고치지 않는다)",
    (_, v) => {
      const bytes = readFileSync(path.join(POLICIES_DIR, v.kind, `${v.version}.tsx`));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(v.sha256);
    },
  );

  test("모든 버전에 본문이 있고, 본문은 목록에 있는 버전만 있다", () => {
    const listed = POLICY_VERSIONS.map((v) => `${v.kind}/${v.version}`).sort();
    expect(Object.keys(POLICY_BODIES).sort()).toEqual(listed);
  });

  test("버전 이름은 KST 시행일과 같다", () => {
    for (const v of POLICY_VERSIONS) {
      expect(v.effectiveAt).toBe(`${v.version}T00:00:00+09:00`);
    }
  });

  test("마이그레이션에 같은 버전·해시 행이 있다 (DB policy_versions 와 일치)", () => {
    const sql = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => readFileSync(path.join(MIGRATIONS_DIR, f), "utf8"))
      .join("\n");
    for (const v of POLICY_VERSIONS) {
      expect(sql).toContain(
        `('${v.kind}', '${v.version}', '${v.version} 00:00:00+09', '${v.sha256}')`,
      );
    }
  });
});

describe("시행 버전 판정 (KST 0시 경계)", () => {
  test("2026-11-28 KST 0시 직전까지는 10-13 판, 0시부터 11-28 판", () => {
    expect(effectiveVersion("terms", new Date("2026-11-27T14:59:59.999Z"))?.version).toBe(
      "2026-10-13",
    );
    expect(effectiveVersion("terms", new Date("2026-11-27T15:00:00.000Z"))?.version).toBe(
      "2026-11-28",
    );
  });

  test("개정 예고는 시행 전까지만 보인다", () => {
    expect(upcomingVersion("terms", new Date("2026-10-29T00:00:00Z"))?.version).toBe("2026-11-28");
    expect(upcomingVersion("terms", new Date("2026-11-27T15:00:00Z"))).toBeUndefined();
  });

  test("시행일 전에는 아무 버전도 없다", () => {
    expect(effectiveVersion("terms", new Date("2026-10-12T14:59:59Z"))).toBeUndefined();
  });

  test("버전은 시행 순서로 정렬된다", () => {
    expect(versionsOf("terms").map((v) => v.version)).toEqual(["2026-10-13", "2026-11-28"]);
  });
});

describe("pendingPolicyKinds", () => {
  const before = new Date("2026-11-20T00:00:00+09:00");
  const after = new Date("2026-11-28T00:00:00+09:00");
  const legacy = [
    { kind: "terms", version: "2026-10-13" },
    { kind: "privacy", version: "2026-10-13" },
  ];

  test("동의 기록이 없으면 두 약관 모두 동의가 필요하다 (첫 Google 로그인)", () => {
    expect(pendingPolicyKinds([], before)).toEqual(["terms", "privacy"]);
  });

  test("기존 회원은 개정 약관 시행 전까지 동의 화면이 없다", () => {
    expect(pendingPolicyKinds(legacy, before)).toEqual([]);
  });

  test("개정 약관 시행일부터는 이용약관만 다시 동의받는다", () => {
    expect(pendingPolicyKinds(legacy, after)).toEqual(["terms"]);
  });

  test("개정 약관에 동의하면 끝난다", () => {
    expect(
      pendingPolicyKinds([...legacy, { kind: "terms", version: "2026-11-28" }], after),
    ).toEqual([]);
  });

  test("목록에 없는 버전·종류 기록은 동의로 치지 않는다", () => {
    const odd = [
      { kind: "terms", version: "2099-01-01" },
      { kind: "refund", version: "2026-10-13" },
      { kind: "privacy", version: "2026-10-13" },
    ];
    expect(pendingPolicyKinds(odd, before)).toEqual(["terms"]);
  });
});

test("koreanDate", () => {
  expect(koreanDate("2026-11-28")).toBe("2026년 11월 28일");
  expect(koreanDate("2026-10-03")).toBe("2026년 10월 3일");
});
