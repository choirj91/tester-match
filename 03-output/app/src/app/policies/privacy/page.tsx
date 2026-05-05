import { PolicyLayout } from "@/components/policy-layout";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "개인정보처리방침" };

export default async function PrivacyPage() {
  const user = await getCurrentUser();
  return (
    <PolicyLayout user={user} active="/policies/privacy" title="개인정보처리방침" effectiveDate="2026년 ○월 ○일">
      <h2>제1조 (수집하는 개인정보 항목)</h2>
      <table>
        <thead>
          <tr><th>구분</th><th>항목</th><th>수집 시점</th></tr>
        </thead>
        <tbody>
          <tr><td>필수</td><td>이메일, Google 프로필(이름·사진)</td><td>회원가입</td></tr>
          <tr><td>자동</td><td>IP, 브라우저, 디바이스 정보</td><td>서비스 이용 중</td></tr>
          <tr><td>결제</td><td>결제 수단 식별값(PG 거래 ID)</td><td>결제 시</td></tr>
          <tr><td>선택</td><td>닉네임, 타임존, 관심 카테고리</td><td>프로필 설정</td></tr>
          <tr><td>선택</td><td>디바이스 모델·OS·Play Integrity 결과</td><td>디바이스 등록</td></tr>
        </tbody>
      </table>
      <p>
        <strong>수집하지 않는 항목:</strong> 주민등록번호, 본인인증 정보, 카드번호 원본(전부 PG 위탁)
      </p>

      <h2>제2조 (수집·이용 목적)</h2>
      <ul>
        <li>회원 식별·인증, 서비스 제공</li>
        <li>매칭 알고리즘 운영</li>
        <li>결제·환불 처리</li>
        <li>분쟁 해결, 부정 이용 방지</li>
        <li>마케팅 정보 발송 (별도 동의 시)</li>
      </ul>

      <h2>제3조 (보유·이용 기간)</h2>
      <table>
        <thead>
          <tr><th>항목</th><th>기간</th><th>근거</th></tr>
        </thead>
        <tbody>
          <tr><td>회원 정보</td><td>탈퇴 시 즉시 파기</td><td>회원의 동의</td></tr>
          <tr><td>결제 기록</td><td>5년</td><td>전자상거래법 제6조</td></tr>
          <tr><td>표시·광고에 관한 기록</td><td>6개월</td><td>전자상거래법 제6조</td></tr>
          <tr><td>부정 이용 기록</td><td>3년</td><td>부정 이용 방지</td></tr>
        </tbody>
      </table>

      <h2>제4조 (제3자 제공)</h2>
      <p>회사는 원칙적으로 회원의 개인정보를 외부에 제공하지 않습니다. 다만 다음의 경우 예외로 합니다:</p>
      <ul>
        <li>회원이 사전 동의한 경우</li>
        <li>법령의 규정에 의한 경우</li>
      </ul>

      <h2>제5조 (위탁 처리)</h2>
      <table>
        <thead>
          <tr><th>수탁자</th><th>위탁 업무</th><th>보관 위치</th></tr>
        </thead>
        <tbody>
          <tr><td>Supabase Inc.</td><td>DB·인증·스토리지 호스팅</td><td>EU/US</td></tr>
          <tr><td>Cloudflare Inc.</td><td>웹 호스팅·DNS·CDN·WAF</td><td>Global Edge</td></tr>
          <tr><td>Resend / Brevo</td><td>이메일 발송</td><td>US/EU</td></tr>
          <tr><td>토스페이먼츠(주)</td><td>국내 결제 (v1)</td><td>한국</td></tr>
          <tr><td>Stripe Inc. (v2)</td><td>해외 결제 — v2 영어권 확장 시</td><td>US/EU</td></tr>
          <tr><td>Sentry</td><td>에러 추적</td><td>US</td></tr>
          <tr><td>PostHog</td><td>행동 분석 (선택 동의)</td><td>EU</td></tr>
        </tbody>
      </table>
      <p>국외 이전 시 GDPR/PIPA의 표준계약(SCC) 또는 동의 절차 준수.</p>

      <h2>제6조 (회원의 권리)</h2>
      <p>회원은 언제든지 다음 권리를 행사할 수 있습니다:</p>
      <ul>
        <li>개인정보 열람·정정·삭제 요청</li>
        <li>개인정보 처리 정지 요청</li>
        <li>회원 탈퇴</li>
      </ul>

      <h2>제7조 (개인정보 보호 책임자)</h2>
      <table>
        <thead>
          <tr><th>구분</th><th>내용</th></tr>
        </thead>
        <tbody>
          <tr><td>책임자</td><td>○○○ (대표)</td></tr>
          <tr><td>연락처</td><td>privacy@testermatch.com</td></tr>
        </tbody>
      </table>

      <h2>제8조 (쿠키 사용)</h2>
      <p>
        회사는 로그인 유지, 통계 분석을 위해 쿠키를 사용합니다. 회원은 브라우저 설정에서 쿠키를 차단할 수 있으나, 일부 서비스 이용에 제한이 있을 수 있습니다.
      </p>
    </PolicyLayout>
  );
}
