import Link from "next/link";
import { PolicyLayout } from "@/components/policy-layout";
import { getCurrentUser } from "@/lib/auth";
import { formatKrw } from "@/lib/credits";
import { PAID_TESTER_PRICE_KRW } from "@/lib/paid-testers";
import {
  REDEMPTION_MAX_CREDITS,
  REDEMPTION_MIN_CREDITS,
  REDEMPTION_UNIT_CREDITS,
} from "@/lib/paid-seats";
import { REWARD_PROCESSING_BUSINESS_DAYS } from "@/lib/rewards";
import { SEAT_REWARD_MAX } from "@/lib/seat-reward-rules";

export const runtime = "edge";

export const metadata = { title: "크레딧 운영 정책" };

export default async function CreditsPolicyPage() {
  const user = await getCurrentUser();
  return (
    <PolicyLayout
      user={user}
      active="/policies/credits"
      title="크레딧 운영 정책"
      effectiveDate="2026년 10월 13일"
    >
      <h2>제1조 (크레딧의 정의와 성격)</h2>
      <p>
        크레딧은 회사가 <strong>유료 테스터 시트를 완주한 테스터 회원에게 테스트 보상으로 발행</strong>하는
        서비스 내 포인트입니다. 보상 가치는 1 크레딧 = 1원 상당으로 계산합니다.
      </p>
      <ul>
        <li>
          <strong>크레딧은 구매할 수 없습니다.</strong> 신용·체크카드, 계좌이체 등 어떤 결제수단으로도 크레딧을
          적립할 수 없으며, 유료 테스터 서비스의 결제 금액은 크레딧으로 전환되지 않습니다.
        </li>
        <li>
          <strong>크레딧은 타인에게 양도·판매·교환할 수 없습니다.</strong> 회원 간 이동은 제공하지 않습니다.
        </li>
        <li>
          <strong>크레딧은 현금으로 환급되지 않습니다.</strong> 제3조의 보상 교환과 시트 열기에만 사용할 수
          있습니다.
        </li>
      </ul>

      <h2>제2조 (크레딧 적립 방법)</h2>
      <p>
        크레딧은 <strong>유료 테스터 시트 참여로만</strong> 적립됩니다 (시트당 최대 {formatKrw(SEAT_REWARD_MAX)}{" "}
        크레딧). 품앗이(무료) 매칭·랭킹·이벤트로는 적립되지 않으며, 품앗이 완주는 신뢰도(+14)로 보상합니다.
      </p>
      <table>
        <thead>
          <tr><th>적립 사유</th><th>적립량</th></tr>
        </thead>
        <tbody>
          <tr><td>설치 인증 (첫 스크린샷 체크인)</td><td>100 크레딧</td></tr>
          <tr><td>출석 (스크린샷 체크인 1일당)</td><td>20 크레딧 (14일 최대 280)</td></tr>
          <tr><td>7일 연속 출석</td><td>+50 크레딧 (시트당 1회)</td></tr>
          <tr><td>완주 (14일 중 12일 이상 출석)</td><td>+120 크레딧</td></tr>
          <tr><td>개근 (14일 모두 출석)</td><td>+50 크레딧</td></tr>
          <tr><td>앱 정식 출시 (앱 등록자가 출시 완료 처리)</td><td>+100 크레딧</td></tr>
        </tbody>
      </table>
      <p>
        설치 인증·출석·연속 출석·완주·개근 보상은 <strong>완주한 시트에 한해</strong> 합산되어 보류되며,{" "}
        <strong>구매자 확정 또는 3일 경과 시 자동 확정</strong>으로 적립됩니다. 결석 3일 이상·중도 이탈 시에는
        지급되지 않습니다. 출시 보너스는 보상이 확정된 시트에 한해, 해당 앱이 출시 완료로 처리된 뒤 지급됩니다.
        리뷰·평점 작성은 보상 대상이 아니며 금지 행위입니다.
      </p>

      <h2>제3조 (크레딧 사용 방법)</h2>
      <p>크레딧은 다음 두 가지에만 사용할 수 있습니다:</p>
      <ul>
        <li>
          <strong>보상 교환</strong> — 기프티콘 또는 네이버페이 포인트(쿠폰)로 교환합니다. 유료 시트 완주로
          적립한 크레딧에 한해 {formatKrw(REDEMPTION_MIN_CREDITS)} 크레딧부터{" "}
          {formatKrw(REDEMPTION_UNIT_CREDITS)} 크레딧 단위(1회 최대 {formatKrw(REDEMPTION_MAX_CREDITS)})로
          신청하며, 본인 휴대폰 번호로 관리자 확인 후 영업일 {REWARD_PROCESSING_BUSINESS_DAYS}일 내 발송합니다.
          한 번호는 한 계정에서만 사용할 수 있습니다. 신청 시 크레딧이 차감되며 거절 시 전액 복구됩니다. 보상
          종류와 절차는{" "}
          <Link href="/rewards">테스터 보상 안내</Link>에 게시합니다.
        </li>
        <li>
          <strong>본인 앱의 유료 테스터 시트 열기</strong> — {formatKrw(PAID_TESTER_PRICE_KRW)} 크레딧 = 시트
          1명 (14일). 과거 품앗이 완주·이벤트 등 유료 시트 참여 외의 사유로 적립된 크레딧은 시트 열기에만
          사용할 수 있습니다.
        </li>
      </ul>

      <h2>제4조 (크레딧 만료)</h2>
      <ul>
        <li>v1: <strong>무기한 보유 가능</strong></li>
        <li>v2 이후: 발급일로부터 12개월 미사용 시 소멸 (사전 30일 전 알림)</li>
      </ul>

      <h2>제5조 (페널티 차감)</h2>
      <table>
        <thead>
          <tr><th>사유</th><th>차감</th></tr>
        </thead>
        <tbody>
          <tr><td>자발적 옵트아웃</td><td>신뢰도 -3. 유료 시트는 적립 예정 크레딧 소멸</td></tr>
          <tr><td>무단 이탈 (유료 시트 결석 3일, 품앗이 5일 연속 미체크인 등)</td><td>신뢰도 -10, 해당 매칭 크레딧 미지급</td></tr>
          <tr><td>설치 불가 신고 (참여 72시간 이내·체크인 전)</td><td>차감 없음 — 앱 등록자 설정 문제로 간주</td></tr>
          <tr><td>부정 참여 적발 (다중 계정·에뮬레이터·무관한 스크린샷·리뷰 작성)</td><td>보상 몰수 및 적립 크레딧 회수, 참여 제한</td></tr>
        </tbody>
      </table>

      <h2>제6조 (회원 탈퇴 시)</h2>
      <p>
        회원 탈퇴 시 보유 크레딧은 모두 소멸하며 환급되지 않습니다. 진행 중인 유료 테스터 주문이나 확정 대기
        중인 보상이 있으면 정산이 끝난 뒤 탈퇴할 수 있습니다.
      </p>
    </PolicyLayout>
  );
}
