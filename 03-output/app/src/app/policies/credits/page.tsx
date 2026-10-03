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
      effectiveDate="2026년 5월 5일"
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
          <tr><td><strong>유료 시트 14일 완주</strong></td><td><strong>700 크레딧</strong> (50 크레딧/일 × 14일, 완주 시 일괄 적립 — 중도 이탈 시 미지급)</td></tr>
          <tr><td>품앗이(무료) 매칭 완주</td><td>신뢰도 +14 (크레딧 적립 없음)</td></tr>
          <tr><td>월간 완주 랭킹 1~3위</td><td>3,000 / 2,000 / 1,000 크레딧</td></tr>
          <tr><td>이벤트</td><td>회사가 정하는 바에 따라</td></tr>
        </tbody>
      </table>

      <h2>제3조 (크레딧 사용 방법)</h2>
      <p>크레딧은 다음에 사용할 수 있습니다:</p>
      <ul>
        <li><strong>본인 앱의 유료 테스터 시트 구매</strong> — 1,000 크레딧 = 시트 1명 (14일)</li>
        <li><strong>기프티콘 교환</strong> — 유료 시트 완주로 적립한 크레딧에 한해 5,000 크레딧 단위로 신청, 관리자 확인 후 영업일 3일 내 발송. 교환 신청 시 크레딧이 차감되며 거절 시 전액 환급</li>
        <li>(v3) 외부 포인트(네이버페이/카카오페이 등) 전환</li>
      </ul>
      <p><strong>크레딧은 현금으로 환급되지 않습니다.</strong> 랭킹 보상·이벤트 등 유료 시트 완주 외의 적립분은 시트 구매에만 사용할 수 있습니다.</p>

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
