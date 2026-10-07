import { describe, expect, test, vi } from "vitest";
import {
  CREDIT_GRANT_ALERT_THRESHOLD,
  formatCreditAnomalies,
  loadCreditAnomalyAlerts,
  type CreditAnomalyRow,
} from "./credit-anomalies";

const row = (
  kind: string,
  userId: number,
  amount: number,
  detail = "",
  kindTotal = 1,
): CreditAnomalyRow => ({ kind, user_id: userId, amount, detail, kind_total: kindTotal });

describe("formatCreditAnomalies", () => {
  test("returns no alert lines when nothing was found", () => {
    expect(formatCreditAnomalies([])).toEqual([]);
  });

  test("groups rows by kind into one Korean line each, with member ids only", () => {
    const lines = formatCreditAnomalies([
      row("grant_spike", 12, 3400, "6건", 2),
      row("grant_spike", 55, 2800, "4건", 2),
      row("retired_type", 12, 2000, "charge #91"),
    ]);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("크레딧 이상");
    expect(lines[0]).toContain("24시간 적립");
    expect(lines[0]).toContain("#12 3,400");
    expect(lines[0]).toContain("#55 2,800");
    expect(lines[1]).toContain("폐지된 적립");
    expect(lines.join(" ")).not.toMatch(/@/);
  });

  test("lists at most five rows per kind and counts the rest from the DB total", () => {
    const rows = Array.from({ length: 20 }, (_, i) =>
      row("negative_balance", i + 1, -100 * (i + 1), "", 27),
    );
    const [line] = formatCreditAnomalies(rows);
    expect(line).toContain("27건");
    expect(line).toContain("외 22건");
  });

  test("says how many members when one member has several rows", () => {
    const [line] = formatCreditAnomalies([
      row("manual_adjust", 7, 10, "#1", 3),
      row("manual_adjust", 7, 10, "#2", 3),
      row("manual_adjust", 9, 10, "#3", 3),
    ]);
    expect(line).toContain("3건 · 회원 2명 이상");
  });

  test("keeps unknown kinds visible instead of dropping them", () => {
    const [line] = formatCreditAnomalies([row("something_new", 3, 10)]);
    expect(line).toContain("something_new");
  });

  test("grant threshold covers three concurrent seats at the maximum reward", () => {
    expect(CREDIT_GRANT_ALERT_THRESHOLD).toBe(2100);
  });
});

describe("loadCreditAnomalyAlerts", () => {
  test("asks for the last 24 hours with the alert thresholds", async () => {
    const rpc = vi.fn(async () => ({ data: [row("negative_balance", 3, -100)], error: null }));
    const now = new Date("2026-10-07T00:00:00Z");
    const lines = await loadCreditAnomalyAlerts({ rpc } as never, now);
    expect(rpc).toHaveBeenCalledWith("credit_anomaly_report", {
      p_since: "2026-10-06T00:00:00.000Z",
      p_grant_threshold: 2100,
      p_redemption_threshold: 20000,
    });
    expect(lines).toHaveLength(1);
  });

  test("turns a failed query into an alert instead of reporting all clear", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const rpc = vi.fn(async () => ({ data: null, error: { message: "function does not exist" } }));
    const lines = await loadCreditAnomalyAlerts({ rpc } as never, new Date());
    expect(lines).toEqual(["크레딧 이상 징후 조회 실패 — 직접 확인이 필요합니다."]);
  });
});
