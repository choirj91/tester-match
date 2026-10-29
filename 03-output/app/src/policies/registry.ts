/**
 * 이용약관·개인정보처리방침 버전 목록.
 *
 * - 본문은 버전별 파일(src/policies/<kind>/<version>.tsx)에 있고, sha256 은 그 파일 바이트의 해시다.
 *   DB public.policy_versions 에 같은 값이 있고, 회원 동의(policy_consents)는 그 행을 가리킨다.
 *   registry.test.ts 가 파일 해시와 마이그레이션 내용을 대조한다.
 * - 시행일이 지난 버전의 파일은 고치지 않는다. 문구를 바꾸려면 새 버전을 추가한다
 *   (DB 도 시행된 행의 수정·삭제를 막는다).
 * - 시행 전 개정안은 고칠 수 있다. 고치면 sha256 과 policy_versions 행을 새 마이그레이션으로 함께 갱신한다.
 */

export type PolicyKind = "terms" | "privacy";

export const POLICY_KINDS: readonly PolicyKind[] = ["terms", "privacy"];

export type PolicyVersion = {
  kind: PolicyKind;
  /** 시행일(KST) YYYY-MM-DD — 버전 이름을 겸한다 */
  version: string;
  /** 시행 시각 — KST 0시 */
  effectiveAt: string;
  sha256: string;
  /** 직전 버전과 달라진 점. 개정 안내와 동의 화면에 그대로 보인다 */
  changes: readonly string[];
};

export const POLICY_VERSIONS: readonly PolicyVersion[] = [
  {
    kind: "terms",
    version: "2026-10-13",
    effectiveAt: "2026-10-13T00:00:00+09:00",
    sha256: "eff35b2c75cd9c04079c7085d51fb8b9f72a0cf07b726e4a423def33417ca41d",
    changes: [],
  },
  {
    kind: "terms",
    version: "2026-11-28",
    effectiveAt: "2026-11-28T00:00:00+09:00",
    sha256: "d46e43a85dca579bc778b33075d461974ebf9012d876917a72f799f88856a96a",
    changes: [
      "제3조: 회원에게 불리하거나 중요한 변경은 시행 30일 전에 공지하고 개정 전후를 비교해 보여 드립니다. 시행 후에는 로그인할 때 개정 약관 동의를 받습니다.",
      "제5조의2 신설: 회사는 명령어 실행, 프로그램 설치, 결제 화면 밖의 송금, 로그인 화면 밖의 계정 정보 입력을 요구하지 않습니다. 이런 요구에 따라 입은 손해는 회원의 과실을 고려합니다.",
      "제7조의2 신설: 회사 귀책으로 하루 누적 4시간 이상 장애가 나면 결석 등을 불리하게 처리하지 않고, 그 장애로 완주하지 못한 유료 시트는 환불합니다.",
      "제8조: 회사의 고의·과실로 생긴 손해는 배상합니다. 회사 과실 없이 생긴 불가항력·해킹·악성 프로그램 손해는 책임지지 않고, 회원 책임이 함께 있으면 그 비율만큼 줄입니다. 개인정보 침해는 개인정보 보호법을 따릅니다.",
      "제10조: 관할 법원을 민사소송법에 따르도록 바꾸고, 준거법(대한민국 법)을 명시했습니다.",
    ],
  },
  {
    kind: "privacy",
    version: "2026-10-13",
    effectiveAt: "2026-10-13T00:00:00+09:00",
    sha256: "ee1843ad010297e6736e854a2bab0c9ce604cd0fa57198dd16675a34a89f31d8",
    changes: [],
  },
];

const effectiveTime = (v: PolicyVersion) => Date.parse(v.effectiveAt);

/** 한 종류의 버전을 시행 순서대로 */
export function versionsOf(kind: PolicyKind): PolicyVersion[] {
  return POLICY_VERSIONS.filter((v) => v.kind === kind).sort(
    (a, b) => effectiveTime(a) - effectiveTime(b),
  );
}

export function findVersion(kind: string, version: string): PolicyVersion | undefined {
  return POLICY_VERSIONS.find((v) => v.kind === kind && v.version === version);
}

/** now 시점에 시행 중인 버전 */
export function effectiveVersion(kind: PolicyKind, now: Date): PolicyVersion | undefined {
  return versionsOf(kind)
    .filter((v) => effectiveTime(v) <= now.getTime())
    .at(-1);
}

/** now 이후 시행될 가장 가까운 버전 (개정 예고) */
export function upcomingVersion(kind: PolicyKind, now: Date): PolicyVersion | undefined {
  return versionsOf(kind).find((v) => effectiveTime(v) > now.getTime());
}

export type ConsentRecord = { kind: string; version: string };

/**
 * 시행 중인 버전에 아직 동의하지 않은 종류. 같은 종류의 더 나중 버전에 동의했으면 동의한 것으로 본다.
 * 목록에 없는 버전 기록은 무시한다.
 */
export function pendingPolicyKinds(consents: readonly ConsentRecord[], now: Date): PolicyKind[] {
  return POLICY_KINDS.filter((kind) => {
    const current = effectiveVersion(kind, now);
    if (!current) return false;
    return !consents.some((c) => {
      const agreed = c.kind === kind ? findVersion(kind, c.version) : undefined;
      return agreed !== undefined && effectiveTime(agreed) >= effectiveTime(current);
    });
  });
}

/** "2026-11-28" → "2026년 11월 28일" */
export function koreanDate(version: string): string {
  const [y, m, d] = version.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일`;
}
