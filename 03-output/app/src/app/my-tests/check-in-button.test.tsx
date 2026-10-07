import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { CheckInButton } from "./check-in-button";

const fetchMock = vi.fn();
const promptMock = vi.fn();
const alertMock = vi.fn();

const ok = () => new Response(JSON.stringify({ ok: true }), { status: 200 });
const fail = (message: string) => new Response(JSON.stringify({ message }), { status: 400 });
const screenshot = () => new File(["png"], "shot.png", { type: "image/png" });
const fileInput = () => screen.getByTestId("checkin-file") as HTMLInputElement;
const pickFile = (file: File | null) =>
  fireEvent.change(fileInput(), { target: { files: file ? [file] : [] } });

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("prompt", promptMock);
  vi.stubGlobal("alert", alertMock);
  fetchMock.mockResolvedValue(ok());
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("CheckInButton — 유료 시트 (탭 2번)", () => {
  test("[오늘 체크인] 을 누르면 파일 선택 창을 연다 — 이 탭만으로는 제출하지 않는다", () => {
    render(<CheckInButton matchId={7} alreadyCheckedToday={false} expired={false} paidSeat />);
    const click = vi.spyOn(fileInput(), "click");

    fireEvent.click(screen.getByRole("button", { name: "오늘 체크인" }));

    expect(click).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("스크린샷을 고르면 추가 확인 없이 같은 체크인 API 로 바로 제출하고 화면을 새로 고친다", async () => {
    render(<CheckInButton matchId={7} alreadyCheckedToday={false} expired={false} paidSeat />);

    pickFile(screenshot());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/matches/7/checkins");
    expect(init.method).toBe("POST");
    const body = init.body as FormData;
    expect((body.get("screenshot") as File).name).toBe("shot.png");
    expect(body.get("comment")).toBe("");
    expect(promptMock).not.toHaveBeenCalled();
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  });

  test("미리 적어 둔 한 줄 피드백을 함께 보낸다 (200자 제한)", async () => {
    render(<CheckInButton matchId={7} alreadyCheckedToday={false} expired={false} paidSeat />);
    fireEvent.change(screen.getByLabelText(/오늘 써본 느낌 한 줄/), {
      target: { value: "로그인이 빨라졌어요" },
    });

    pickFile(screenshot());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const body = (fetchMock.mock.calls[0][1] as RequestInit).body as FormData;
    expect(body.get("comment")).toBe("로그인이 빨라졌어요");
  });

  test("파일 없이 change 가 오면 제출하지 않고 첨부 안내를 보여 준다", async () => {
    render(<CheckInButton matchId={7} alreadyCheckedToday={false} expired={false} paidSeat />);

    pickFile(null);

    expect(await screen.findByRole("alert")).toHaveTextContent("스크린샷 1장을 첨부해주세요");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("서버가 거절하면 서버 메시지를 그대로 보여 주고 새로 고치지 않는다", async () => {
    fetchMock.mockResolvedValue(fail("오늘은 이미 체크인했습니다."));
    render(<CheckInButton matchId={7} alreadyCheckedToday={false} expired={false} paidSeat />);

    pickFile(screenshot());

    expect(await screen.findByRole("alert")).toHaveTextContent("오늘은 이미 체크인했습니다.");
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "오늘 체크인" })).toBeEnabled();
  });
});

describe("CheckInButton — 품앗이 / 상태", () => {
  test("품앗이는 한 번 누르면 본문 없이 체크인한다", async () => {
    render(<CheckInButton matchId={3} alreadyCheckedToday={false} expired={false} />);

    fireEvent.click(screen.getByRole("button", { name: "오늘 체크인" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/matches/3/checkins", { method: "POST" }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  });

  test("오늘 이미 체크인했으면 완료 표시만 하고 버튼이 없다", () => {
    render(<CheckInButton matchId={3} alreadyCheckedToday expired={false} paidSeat />);

    expect(screen.getByText("오늘 체크인 완료")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("기간이 끝났으면 비활성 버튼", () => {
    render(<CheckInButton matchId={3} alreadyCheckedToday={false} expired />);

    expect(screen.getByRole("button", { name: "체크인 기간 만료" })).toBeDisabled();
  });
});
