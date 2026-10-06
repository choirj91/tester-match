import { PolicyLayout } from "@/components/policy-layout";
import { getCurrentUser } from "@/lib/auth";

export const runtime = 'edge';

export const metadata = { title: "개인정보처리방침" };

export default async function PrivacyPage() {
  const user = await getCurrentUser();
  return (
    <PolicyLayout user={user} active="/policies/privacy" title="개인정보처리방침" effectiveDate="2026년 10월 13일">
      <h2>제1조 (수집하는 개인정보 항목)</h2>
      <table>
        <thead>
          <tr><th>구분</th><th>항목</th><th>수집 시점</th></tr>
        </thead>
        <tbody>
          <tr><td>필수</td><td>이메일, Google 프로필(이름·사진)</td><td>Google 계정으로 회원가입</td></tr>
          <tr><td>필수</td><td>이메일, 비밀번호(암호화 저장), 닉네임, 카카오톡 닉네임</td><td>이메일로 회원가입</td></tr>
          <tr><td>자동</td><td>IP, 브라우저, 디바이스 정보</td><td>서비스 이용 중</td></tr>
          <tr><td>결제</td><td>결제 수단 식별값(PG 거래 ID), 주문 금액·주문번호</td><td>결제 시</td></tr>
          <tr><td>결제</td><td>구매자 이름(닉네임)·이메일·휴대폰 번호 — 결제창 호출 시 결제대행사(KG이니시스)에 구매자 정보로 전달. 휴대폰 번호는 회사 서버·DB 에 저장하지 않음</td><td>카드 결제 시</td></tr>
          <tr><td>문의</td><td>문의 제목·내용 (회원이 직접 입력)</td><td>1:1 문의 접수 시</td></tr>
          <tr><td>선택</td><td>닉네임, 카카오톡 닉네임(커뮤니티 오픈채팅 회원 확인·안내용, 비공개), 타임존, 관심 카테고리</td><td>프로필 설정</td></tr>
          <tr><td>선택</td><td>디바이스 모델·OS·Play Integrity 결과</td><td>디바이스 등록</td></tr>
        </tbody>
      </table>
      <p>
        <strong>수집하지 않는 항목:</strong> 주민등록번호, 본인인증 정보, 카드번호 원본(전부 PG 위탁)
      </p>
      <p>
        <strong>유료 테스터 시트 관련 추가 수집:</strong> 시트 참여 테스터가 체크인 시 업로드하는
        앱 실행 화면 스크린샷(비공개 저장소 보관, 해당 앱 등록자와 운영자에게만 공개, 중도 이탈 시
        삭제·주문 종료 후 1년 보관), 보상 교환(기프티콘·네이버페이 포인트) 신청 시 입력하는 수신
        휴대폰 번호(발송 목적 외 사용하지 않으며 처리 완료 후 1년 보관), 구매 전 유의사항 동의 시각.
        스크린샷에 본인 또는 타인의 개인정보가 포함되지 않도록 주의해 주세요.
      </p>


      <h2>제2조 (수집·이용 목적)</h2>
      <ul>
        <li>회원 식별·인증, 서비스 제공</li>
        <li>매칭 알고리즘 운영</li>
        <li>결제·환불 처리</li>
        <li>문의 응대, 처리 결과 안내</li>
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
          <tr><td>문의·불만 처리 기록</td><td>3년 이상 (3년이 지난 기록은 회원이 삭제를 요청하면 지체 없이 파기)</td><td>전자상거래법 제6조</td></tr>
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
          <tr><td>KG이니시스(주)</td><td>신용·체크카드 결제 처리 (구매자 이름·이메일·휴대폰 번호 전달)</td><td>한국</td></tr>
          <tr><td>(주)코리아포트원</td><td>결제 연동 (결제 요청·조회 중계)</td><td>한국</td></tr>
          <tr><td>Slack Technologies, LLC</td><td>문의 접수 알림 — 운영팀 내부 메신저로 닉네임·문의 제목·내용 일부 전달 (이메일 등 연락처 제외)</td><td>US</td></tr>
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
          <tr><td>책임자</td><td>낰낰컴퍼니 대표</td></tr>
          <tr><td>연락처</td><td>admin@knockknock.company</td></tr>
        </tbody>
      </table>

      <h2>제8조 (쿠키 사용)</h2>
      <p>
        회사는 로그인 유지, 통계 분석을 위해 쿠키를 사용합니다. 회원은 브라우저 설정에서 쿠키를 차단할 수 있으나, 일부 서비스 이용에 제한이 있을 수 있습니다.
      </p>
    </PolicyLayout>
  );
}
