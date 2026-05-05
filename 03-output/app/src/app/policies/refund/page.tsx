import { PolicyLayout } from "@/components/policy-layout";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "환불 정책" };

export default async function RefundPage() {
  const user = await getCurrentUser();
  return (
    <PolicyLayout user={user} active="/policies/refund" title="환불 정책" effectiveDate="2026년 ○월 ○일">
      <h2>제1조 (크레딧 충전 환불)</h2>
      <table>
        <thead>
          <tr><th>조건</th><th>환불액</th><th>처리</th></tr>
        </thead>
        <tbody>
          <tr><td>충전 후 7일 이내 + 사용 0건</td><td>100%</td><td>자동 승인</td></tr>
          <tr><td>충전 후 7일 이내 + 일부 사용</td><td>미사용분 비례 (PG 수수료 차감)</td><td>자동 승인</td></tr>
          <tr><td>충전 후 7일 초과</td><td>환불 불가</td><td>—</td></tr>
          <tr><td>회사 귀책(시스템 오류 등)</td><td>100%</td><td>운영팀 검토</td></tr>
        </tbody>
      </table>

      <h2>제2조 (Boost 결제 환불)</h2>
      <table>
        <thead>
          <tr><th>조건</th><th>환불액</th></tr>
        </thead>
        <tbody>
          <tr><td>SLA 시간 내 12명 매칭 성공</td><td>환불 없음 (정상 제공)</td></tr>
          <tr><td>SLA 시간 초과, 12명 중 N명 매칭</td><td>(12-N)/12 비례 환불</td></tr>
          <tr><td>SLA 시간 초과, 0명 매칭</td><td>100% 환불</td></tr>
          <tr><td>사용자 단순 변심</td><td>환불 불가 (단, 매칭 시작 전이면 100%)</td></tr>
        </tbody>
      </table>

      <h2>제3조 (환불 처리 기간)</h2>
      <table>
        <thead>
          <tr><th>결제 수단</th><th>처리 기간</th></tr>
        </thead>
        <tbody>
          <tr><td>토스페이먼츠 (국내 카드)</td><td>영업일 3~5일</td></tr>
          <tr><td>토스페이먼츠 (계좌이체/카카오페이)</td><td>영업일 1~3일</td></tr>
          <tr><td>Stripe (해외 카드)</td><td>영업일 5~10일</td></tr>
        </tbody>
      </table>

      <h2>제4조 (환불 신청 방법)</h2>
      <p>마이페이지 → 크레딧 → 환불 신청 → 자동 승인</p>

      <h2>제5조 (분쟁 시 절차)</h2>
      <ol>
        <li>1차: 운영팀 메일 (support@testermatch.com)</li>
        <li>2차: 한국소비자원 또는 공정거래위원회 분쟁조정</li>
      </ol>
    </PolicyLayout>
  );
}
