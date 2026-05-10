import { PolicyLayout } from "@/components/policy-layout";
import { getCurrentUser } from "@/lib/auth";

export const runtime = 'edge';

export const metadata = { title: "크레딧 운영 정책" };

export default async function CreditsPolicyPage() {
  const user = await getCurrentUser();
  return (
    <PolicyLayout
      user={user}
      active="/policies/credits"
      title="크레딧 운영 정책"
      effectiveDate="2026년 ○월 ○일"
    >
      <h2>제1조 (크레딧의 정의)</h2>
      <p>
        크레딧은 회사가 회원에게 발행하는 <strong>서비스 내 사용 가능한 비현금성 포인트</strong>로, 1원 = 1 크레딧으로 환산됩니다.
      </p>

      <h2>제2조 (크레딧 적립 방법)</h2>
      <table>
        <thead>
          <tr><th>적립 사유</th><th>적립량</th></tr>
        </thead>
        <tbody>
          <tr><td>회원가입 환영</td><td>200 크레딧 (테스터) / 1,200 크레딧 (개발자, 1회)</td></tr>
          <tr><td>14일 테스트 완주</td><td>800 크레딧 (1매칭당)</td></tr>
          <tr><td>급구 매칭 완주</td><td>1,600 크레딧 (2배)</td></tr>
          <tr><td>친구 초대 (v2)</td><td>추후 안내</td></tr>
          <tr><td>이벤트</td><td>회사가 정하는 바에 따라</td></tr>
        </tbody>
      </table>

      <h2>제3조 (크레딧 사용 방법)</h2>
      <p>크레딧은 다음에 사용할 수 있습니다:</p>
      <ul>
        <li>본인의 앱 등록 시 매칭 비용 차감</li>
        <li>(v2) 부가 서비스(스크린샷·번역·ASO 등) 결제</li>
        <li>(v3) 외부 포인트(네이버페이/카카오페이 등) 전환</li>
      </ul>

      <h2>제4조 (크레딧 만료)</h2>
      <ul>
        <li>v1: <strong>무기한 보유 가능</strong></li>
        <li>v2 이후: 발급일로부터 12개월 미사용 시 소멸 (사전 30일 전 알림)</li>
      </ul>

      <h2>제5조 (외부 포인트 전환 — v3)</h2>
      <p>v1 에서는 비활성. v3 에서 회사가 선불전자지급수단 발행업 등록 완료 후 활성화 예정.</p>
      <table>
        <thead>
          <tr><th>항목</th><th>정책 (v3 예정)</th></tr>
        </thead>
        <tbody>
          <tr><td>전환 비율</td><td>1,000 크레딧 = 800 외부 포인트 (수수료 20%)</td></tr>
          <tr><td>최소 전환</td><td>5,000 크레딧</td></tr>
          <tr><td>월 한도</td><td>50,000 크레딧 (자금세탁방지)</td></tr>
          <tr><td>처리 기간</td><td>익영업일</td></tr>
        </tbody>
      </table>

      <h2>제6조 (페널티 차감)</h2>
      <table>
        <thead>
          <tr><th>사유</th><th>차감</th></tr>
        </thead>
        <tbody>
          <tr><td>자발적 옵트아웃</td><td>Trust Score -10 (크레딧 직접 차감 없음)</td></tr>
          <tr><td>미설치·부정 적발</td><td>해당 매칭 크레딧 미지급 + Trust Score -15</td></tr>
        </tbody>
      </table>

      <h2>제7조 (회원 탈퇴 시)</h2>
      <p>
        회원 탈퇴 시 보유 크레딧은 모두 소멸하며, 환불되지 않습니다(단, 충전 후 7일 미사용분은 환불 정책에 따라 환불 가능).
      </p>
    </PolicyLayout>
  );
}
