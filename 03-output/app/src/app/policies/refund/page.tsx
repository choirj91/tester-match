import Link from "next/link";
import { PolicyLayout } from "@/components/policy-layout";
import { getCurrentUser } from "@/lib/auth";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata = {
  title: "환불 정책",
  description:
    "Tester Match 유료 테스터 서비스의 청약철회·환불 기준, 환불 처리 기간, 신청 방법과 분쟁 해결 절차를 안내합니다.",
  alternates: { canonical: "/policies/refund" },
};

export default async function RefundPage() {
  const user = await getCurrentUser();
  return (
    <PolicyLayout
      user={user}
      active="/policies/refund"
      title="환불 정책"
      effectiveDate="2026년 10월 13일"
    >
      <p>
        본 정책은 낰낰컴퍼니(Knock Knock Company)가 운영하는 Tester Match 의 유료 서비스에
        대한 청약철회 및 환불 기준을 정합니다. 「전자상거래 등에서의 소비자보호에 관한
        법률」 및 관련 법령을 따르며, 법령과 본 정책이 다를 경우 법령이 우선합니다.
      </p>

      <h2>제1조 (적용 대상 서비스)</h2>
      <table>
        <thead>
          <tr>
            <th>서비스</th>
            <th>내용</th>
            <th>가격</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>유료 테스터</td>
            <td>
              회사가 모집·관리하는 커뮤니티 테스터가 신청 앱의 유료 시트에 참여해 14일간 매일
              실행·스크린샷 체크인 (비실물 서비스, 완주한 시트만 과금). 판매·환불 주체는 회사입니다
            </td>
            <td>테스터 1명당 1,100원 (부가세 포함), 1~30명 선택</td>
          </tr>
        </tbody>
      </table>
      <p>
        회사는 크레딧을 판매하지 않습니다(충전 기능 없음). 급구(Boost) 표시는 유료 테스터 시트에
        포함된 기능으로 따로 판매하지 않으며, 환불은 시트 기준으로 처리합니다. 그 외 유료 기능은 현재
        제공하지 않으며, 새 유료 기능을 제공할 때는 본 정책에 조항을 추가해 시행일과 함께 공지합니다.
      </p>

      <h2>제2조 (유료 테스터 청약철회 및 환불)</h2>
      <table>
        <thead>
          <tr>
            <th>시점</th>
            <th>환불액</th>
            <th>비고</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>테스터가 시트에 참여하기 전</td>
            <td>결제 금액의 100%</td>
            <td>요청 시 즉시. 결제일로부터 7일 이내 별도 사유 없이 가능</td>
          </tr>
          <tr>
            <td>결제 후 7일(충원 기간)까지 채워지지 않은 시트</td>
            <td>해당 시트 결제 금액의 100%</td>
            <td>자동 처리 — 크레딧으로 연 시트는 즉시 복구, 카드 결제는 영업일 3일 내 부분 취소</td>
          </tr>
          <tr>
            <td>충원 기간 중 테스터 이탈</td>
            <td>환불 없음</td>
            <td>시트가 다시 열려 교체 테스터가 1일차부터 진행</td>
          </tr>
          <tr>
            <td>충원 마감 후 테스터 이탈로 완주하지 못한 시트</td>
            <td>해당 시트 결제 금액의 100%</td>
            <td>자동 처리</td>
          </tr>
          <tr>
            <td>이의 제기가 인용된 시트 (테스터 보상 몰수)</td>
            <td>해당 시트 결제 금액의 100%</td>
            <td>스크린샷 증빙에 근거한 운영팀 판정</td>
          </tr>
          <tr>
            <td>완주 후 확정(또는 3일 무응답 자동 확정)된 시트</td>
            <td>환불 불가</td>
            <td>서비스 제공이 완료된 경우</td>
          </tr>
        </tbody>
      </table>
      <p>
        시트 참여 여부와 일차별 이행 내역은 구매자 콘솔(주문 상세)에서 출석표와 실행
        스크린샷으로 확인할 수 있습니다. 보상으로 적립한 크레딧으로 연 시트는 동일 금액의 크레딧으로
        복구됩니다 (현금 환급 없음).
      </p>

      <h2>제3조 (환불 처리 기간 및 수단)</h2>
      <table>
        <thead>
          <tr>
            <th>결제 수단</th>
            <th>처리 기간</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>신용·체크카드 (KG이니시스)</td>
            <td>환불 승인 후 영업일 3~5일 (카드사 사정에 따라 상이)</td>
          </tr>
        </tbody>
      </table>
      <p>환불은 원결제 수단으로만 진행하며, 환불 요청 접수 후 영업일 3일 이내에 승인 여부를 회신합니다.</p>

      <h2>제4조 (환불 신청 방법)</h2>
      <ol>
        <li>
          운영팀 메일 <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> 로 주문번호(pt_ 로
          시작)·앱 이름·환불 사유를 보내주세요.
        </li>
        <li>운영팀이 콘솔 이행 기록을 확인해 제2조 기준으로 환불액을 산정하고 회신합니다.</li>
        <li>승인 후 결제대행사(KG이니시스)를 통해 원결제 수단으로 환불됩니다.</li>
      </ol>

      <h2>제5조 (분쟁 해결)</h2>
      <ol>
        <li>1차: 운영팀 메일 ({CONTACT_EMAIL}) — 영업일 3일 이내 회신</li>
        <li>2차: 한국소비자원(1372 소비자상담센터) 또는 전자거래분쟁조정위원회 조정 신청</li>
      </ol>

      <h2>제6조 (정책 변경)</h2>
      <p>
        본 정책을 변경할 경우 시행 7일 전에 서비스 내 공지사항으로 안내하며, 변경 전에
        결제한 주문에는 결제 시점의 정책이 적용됩니다. 관련 문서:{" "}
        <Link href="/policies/terms">이용약관</Link>,{" "}
        <Link href="/policies/privacy">개인정보처리방침</Link>.
      </p>
    </PolicyLayout>
  );
}
