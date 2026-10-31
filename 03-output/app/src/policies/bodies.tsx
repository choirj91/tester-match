import type { ReactNode } from "react";
import { PRIVACY_2026_10_13 } from "./privacy/2026-10-13";
import type { PolicyKind } from "./registry";
import { TERMS_2026_10_13 } from "./terms/2026-10-13";
import { TERMS_2026_12_01 } from "./terms/2026-12-01";

/** 버전 → 본문. registry.ts 에 버전을 추가하면 여기에도 추가한다 (registry.test.ts 가 확인) */
export const POLICY_BODIES: Readonly<Record<`${PolicyKind}/${string}`, ReactNode>> = {
  "terms/2026-10-13": TERMS_2026_10_13,
  "terms/2026-12-01": TERMS_2026_12_01,
  "privacy/2026-10-13": PRIVACY_2026_10_13,
};

export function policyBody(kind: PolicyKind, version: string): ReactNode | undefined {
  return POLICY_BODIES[`${kind}/${version}`];
}
