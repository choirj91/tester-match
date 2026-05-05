import { render, screen } from "@testing-library/react";
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

  it("renders nav links", () => {
    render(<SiteHeader user={user} />);
    // 데스크톱 + 모바일 nav 둘 다 있어 2개씩 렌더됨
    expect(screen.getAllByText("매칭 가능").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("게시판").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("내 앱").length).toBeGreaterThanOrEqual(1);
  });

  it('shows "준비중" badge for boost', () => {
    render(<SiteHeader user={user} />);
    expect(screen.getAllByText("준비중").length).toBeGreaterThanOrEqual(1);
  });

  it("renders nickname and signout when authenticated", () => {
    render(<SiteHeader user={user} />);
    expect(screen.getByText("테스터")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "로그아웃" })).toBeInTheDocument();
  });

  it("renders credit balance chip when authenticated", () => {
    render(<SiteHeader user={user} />);
    expect(screen.getByTitle("크레딧 잔액")).toHaveTextContent("1,600");
  });

  it("renders login button when unauthenticated", () => {
    render(<SiteHeader user={null} />);
    expect(screen.getByRole("link", { name: "로그인" })).toBeInTheDocument();
  });
});
