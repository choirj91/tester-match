import { afterEach, describe, expect, test, vi } from "vitest";
import { publicOrigin } from "./public-origin";

function req(url: string, headers: Record<string, string> = {}): Request {
  return new Request(url, { headers });
}

describe("publicOrigin", () => {
  afterEach(() => vi.unstubAllEnvs());

  test("request.url 이 실제 주소면 그대로 (next dev·edge)", () => {
    expect(publicOrigin(req("http://localhost:3000/auth/callback?code=x"))).toBe(
      "http://localhost:3000",
    );
  });

  test("standalone 바인딩 주소면 Host 헤더의 운영 도메인으로 복원", () => {
    const r = req("http://0.0.0.0:8080/auth/callback", { host: "tester-match.knockknock.company" });
    expect(publicOrigin(r)).toBe("https://tester-match.knockknock.company");
  });

  test("App Service 기본 호스트(WEBSITE_HOSTNAME)도 허용", () => {
    vi.stubEnv("WEBSITE_HOSTNAME", "app-testermatch-prod-krc.azurewebsites.net");
    const r = req("http://0.0.0.0:8080/", { host: "app-testermatch-prod-krc.azurewebsites.net" });
    expect(publicOrigin(r)).toBe("https://app-testermatch-prod-krc.azurewebsites.net");
  });

  test("목록에 없는 Host 는 믿지 않고 운영 주소로 (오픈 리다이렉트 방지)", () => {
    const r = req("http://0.0.0.0:8080/", { host: "evil.example" });
    expect(publicOrigin(r)).toBe("https://tester-match.knockknock.company");
  });

  test("x-forwarded-host 가 있으면 우선 (첫 값만)", () => {
    const r = req("http://0.0.0.0:8080/", {
      host: "internal",
      "x-forwarded-host": "tester-match.knockknock.company, other",
    });
    expect(publicOrigin(r)).toBe("https://tester-match.knockknock.company");
  });

  test("Host 헤더가 없으면 운영 주소", () => {
    expect(publicOrigin(req("http://0.0.0.0:8080/"))).toBe("https://tester-match.knockknock.company");
  });
});
