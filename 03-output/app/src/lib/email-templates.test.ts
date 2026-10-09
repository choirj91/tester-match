import { describe, expect, test } from "vitest";
import {
  paidOrderReceiptEmail,
  paidOrdersDailyReportEmail,
  weeklyReportEmail,
} from "./email-templates";
import type { GainList, GainReport, GainRow } from "./gain-report";

const base = {
  buyerNickname: "개발자",
  appName: "가계부",
  testerCount: 14,
  amountKrw: 15400,
  orderCode: "pt_0123456789abcdef0123456789abcdef",
};

describe("paidOrderReceiptEmail", () => {
  test("says the boost and member notice went out when seats were opened", () => {
    const mail = paidOrderReceiptEmail({ ...base, seatsOpened: true });
    expect(mail.html).toContain("급구 노출과 전 회원 알림이 나갔고");
  });

  test("does not claim a boost for review orders whose seats stay closed", () => {
    const mail = paidOrderReceiptEmail({ ...base, seatsOpened: false });
    expect(mail.html).not.toContain("급구 노출");
    expect(mail.html).toContain("시트를 열지 않았습니다");
    expect(mail.html).not.toContain("7일 내 채워지지 않은 시트는 자동 환불");
  });
});

function gainList(kind: GainRow["kind"], count: number): GainList {
  const rows = Array.from({ length: count }, (_, i) => ({
    kind,
    user_id: i + 1,
    nickname: i === 0 ? "<script>&닉" : `회원${i + 1}`,
    gained: (count - i) * 10,
    entries: 1,
    detail: kind === "credit" ? "earn 600" : "reward.checkin 1",
  }));
  return { members: count, gained: rows.reduce((s, r) => s + r.gained, 0), rows };
}

const okGains = (credit: GainList, trust: GainList): GainReport => ({ ok: true, credit, trust });

describe("paidOrdersDailyReportEmail — member gain lists", () => {
  const daily = { dateLabel: "2026-10-09", orders: [], autoCanceledCount: 0, yearlyPaidCount: 3 };

  test("adds both lists with totals and escaped nicknames, without changing the subject", () => {
    const mail = paidOrdersDailyReportEmail({
      ...daily,
      gains: okGains(gainList("credit", 2), gainList("trust", 0)),
    });
    expect(mail.subject).toBe("[Tester Match] 유료 테스터 일일 리포트 2026-10-09 — 진행 0건");
    expect(mail.html).toContain("크레딧 증가 — 최근 24시간");
    expect(mail.html).toContain("2명 · 합계 30 크레딧");
    expect(mail.html).toContain("&lt;script&gt;&amp;닉");
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("+20 크레딧");
    expect(mail.html).toContain("신뢰도 증가 — 최근 24시간");
    expect(mail.html).toContain("증가한 회원이 없습니다.");
    expect(mail.text).toContain("[크레딧 증가 — 최근 24시간] 2명 · 합계 30 크레딧");
    expect(mail.text).toContain("[신뢰도 증가 — 최근 24시간] 없음");
    // 기존 내용은 그대로
    expect(mail.html).toContain("올해 누적 결제 3건");
  });

  test("leaves the lists out when there is no gain report (the caller puts the failure in alerts)", () => {
    const mail = paidOrdersDailyReportEmail({ ...daily, gains: { ok: false, alert: "조회 실패" } });
    expect(mail.html).not.toContain("크레딧 증가");
    expect(paidOrdersDailyReportEmail(daily).html).not.toContain("크레딧 증가");
  });
});

describe("weeklyReportEmail", () => {
  const windowLabel = "10/02 22:00 – 10/09 22:00";

  test("subject names the window and counts; the mail lists at most 100 members per kind", () => {
    const mail = weeklyReportEmail({
      windowLabel,
      gains: okGains(gainList("credit", 130), gainList("trust", 4)),
    });
    expect(mail.subject).toBe(
      "[Tester Match] 주간 리포트 10/02 22:00 – 10/09 22:00 — 크레딧 증가 130명 · 신뢰도 증가 4명",
    );
    expect(mail.html).toContain("크레딧 증가 — 지난 7일");
    expect(mail.html).toContain("외 30명");
    expect(mail.html.match(/<td style="[^"]*">#\d+<\/td>/g)).toHaveLength(104);
    expect(mail.html).not.toMatch(/[0-9] ?원|₩/);
    expect(mail.text.split("\n").filter((l) => l.startsWith("- #"))).toHaveLength(104);
  });

  test("a failed query is an [ACTION] mail with the alert, not an empty report", () => {
    const mail = weeklyReportEmail({ windowLabel, gains: { ok: false, alert: "조회 실패 <b>" } });
    expect(mail.subject.startsWith("[ACTION] ")).toBe(true);
    expect(mail.html).toContain("조회 실패 &lt;b&gt;");
    expect(mail.html).not.toContain("증가한 회원이 없습니다");
    expect(mail.text).toContain("[처리 필요] 조회 실패 <b>");
  });
});
