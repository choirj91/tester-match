import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteHeader } from "./site-header";

describe("SiteHeader", () => {
  const user = {
    id: 1,
    authUserId: "uuid",
    email: "test@example.com",
    nickname: "테스터",
    trustScore: 50,
    role: "user" as const,
    balance: 1600,
  };

  it("renders the four primary menu items", () => {
    render(<SiteHeader user={user} />);
    const nav = screen.getByRole("navigation", { name: "주 메뉴" });
    for (const label of ["테스트하기", "테스터 모으기", "커뮤니티", "내 공간"]) {
      expect(within(nav).getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("opens the second-level row under the header on hover", () => {
    render(<SiteHeader user={user} />);
    fireEvent.mouseEnter(screen.getAllByRole("link", { name: "테스터 모으기" })[0]);
    const row = screen.getByRole("navigation", { name: "테스터 모으기 메뉴" });
    expect(within(row).getByRole("link", { name: "급구" })).toHaveAttribute("href", "/paid-testers");
    expect(within(row).getByRole("link", { name: "맞테스트" })).toBeInTheDocument();
    expect(screen.queryByText("맞리뷰")).not.toBeInTheDocument();
  });

  it("keeps all eleven menus reachable from the mobile menu", () => {
    render(<SiteHeader user={user} />);
    fireEvent.click(screen.getByRole("button", { name: "메뉴 열기" }));
    const menu = document.getElementById("mobile-menu")!;
    for (const label of [
      "매칭 가능", "내 테스트", "내 앱", "급구", "맞테스트", "게시판",
      "가이드", "랭킹", "보상", "크레딧", "프로필",
    ]) {
      expect(within(menu).getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("renders nickname, trust score and signout when authenticated", () => {
    render(<SiteHeader user={user} />);
    expect(screen.getAllByText("테스터").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("신뢰도 50").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("button", { name: "로그아웃" }).length).toBeGreaterThanOrEqual(1);
  });

  it("renders the credit chip without a currency sign", () => {
    render(<SiteHeader user={user} />);
    const chip = screen.getAllByTitle("크레딧 잔액")[0];
    expect(chip).toHaveTextContent("크레딧 1,600");
    expect(chip.textContent).not.toMatch(/[₩원]/);
  });

  it("renders login and sends 내 공간 to login when unauthenticated", () => {
    render(<SiteHeader user={null} />);
    expect(screen.getAllByRole("link", { name: "로그인" }).length).toBeGreaterThanOrEqual(1);
    const nav = screen.getByRole("navigation", { name: "주 메뉴" });
    expect(within(nav).getByRole("link", { name: "내 공간" })).toHaveAttribute("href", "/auth/login");
  });

  it("renders a four-tab bottom bar", () => {
    render(<SiteHeader user={user} />);
    const tabs = screen.getByRole("navigation", { name: "하단 탭" });
    expect(within(tabs).getAllByRole("link")).toHaveLength(4);
  });
});
