// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/cron-auth", () => ({ verifyCronAuth: vi.fn(() => true) }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn(() => ({})) }));
vi.mock("@/lib/seat-rewards", () => ({
  releaseDueRewards: vi.fn(),
  repairMissingHolds: vi.fn(async () => 0),
  repairReleasedWithoutEarn: vi.fn(async () => 0),
  grantLaunchBonuses: vi.fn(async () => ({ granted: 0, remaining: 0 })),
}));
vi.mock("@/lib/referrals", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/referrals")>()),
  grantReferralRewards: vi.fn(),
}));

import { emptyReferralSummary, grantReferralRewards } from "@/lib/referrals";
import { grantLaunchBonuses, releaseDueRewards } from "@/lib/seat-rewards";
import { GET } from "./route";

const run = async () =>
  (await (await GET(new Request("http://localhost/api/cron/seat-reward-release"))).json()) as Record<
    string,
    unknown
  >;

afterEach(() => {
  vi.clearAllMocks();
});

describe("seat-reward-release — 친구 추천 신뢰도 보너스 단계", () => {
  test("지급한 호출은 기존처럼 바로 돌아가고 추천 단계는 다음 호출로 미룬다", async () => {
    vi.mocked(releaseDueRewards).mockResolvedValue({ attempted: 2, released: 2, remaining: 0 });
    const body = await run();
    expect(body).toMatchObject({ released: 2, more: true });
    expect(grantReferralRewards).not.toHaveBeenCalled();
  });

  test("보통 호출: 출시 보너스 뒤에 5건 한도로 지급하고 결과를 응답에 싣는다", async () => {
    vi.mocked(releaseDueRewards).mockResolvedValue({ attempted: 0, released: 0, remaining: 0 });
    const referral = { ...emptyReferralSummary(), checked: 1, granted: 1 };
    vi.mocked(grantReferralRewards).mockResolvedValue(referral);

    const body = await run();

    expect(grantReferralRewards).toHaveBeenCalledWith(expect.anything(), { limit: 5 });
    expect(vi.mocked(grantLaunchBonuses).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(grantReferralRewards).mock.invocationCallOrder[0],
    );
    expect(body.referral).toEqual(referral);
    expect(body.more).toBe(false);
  });

  test("지급이 진행됐고 남은 대상이 있으면 more", async () => {
    vi.mocked(releaseDueRewards).mockResolvedValue({ attempted: 0, released: 0, remaining: 0 });
    vi.mocked(grantReferralRewards).mockResolvedValue({
      ...emptyReferralSummary(),
      checked: 7,
      granted: 5,
      remaining: 2,
    });
    expect((await run()).more).toBe(true);
  });

  test("무효로 끝낸 것도 진전이다 — 남은 대상이 있으면 more", async () => {
    vi.mocked(releaseDueRewards).mockResolvedValue({ attempted: 0, released: 0, remaining: 0 });
    vi.mocked(grantReferralRewards).mockResolvedValue({
      ...emptyReferralSummary(),
      checked: 7,
      voided: { self_purchase: 3, inactive: 1, referrer_cap: 1 },
      remaining: 2,
    });
    expect((await run()).more).toBe(true);
  });

  test("진전 없이 남기만 하면 반복하지 않는다 (막힌 건 때문에 무한 반복 금지)", async () => {
    vi.mocked(releaseDueRewards).mockResolvedValue({ attempted: 0, released: 0, remaining: 0 });
    vi.mocked(grantReferralRewards).mockResolvedValue({
      ...emptyReferralSummary(),
      checked: 7,
      failed: 5,
      remaining: 2,
    });
    expect((await run()).more).toBe(false);
  });

  test("지급 시도가 전부 실패한 호출(strained)은 추천 단계를 건너뛴다", async () => {
    vi.mocked(releaseDueRewards).mockResolvedValue({ attempted: 3, released: 0, remaining: 3 });
    const body = await run();
    expect(grantReferralRewards).not.toHaveBeenCalled();
    expect(body.referral).toEqual(emptyReferralSummary());
    expect(body.more).toBe(false);
  });
});
