import { permanentRedirect } from "next/navigation";

/**
 * 급구는 유료 테스터 결제가 확정될 때 함께 켜진다 (무료 급구 켜기는 폐지).
 * 예전 급구 안내 주소·북마크·알림 링크는 급구 신청 화면으로 보낸다.
 */
export default function BoostPage(): never {
  permanentRedirect("/paid-testers");
}
