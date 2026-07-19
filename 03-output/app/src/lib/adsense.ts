/**
 * Google AdSense 설정.
 *
 * 슬롯 ID 는 AdSense 대시보드 → 광고 → 광고 단위별 에서 생성 후 붙여넣기.
 * 빈 문자열이면 해당 위치 광고는 렌더링되지 않음 (안전 기본값).
 */
export const ADSENSE_CLIENT = "ca-pub-6738372737459853";

export const AD_SLOTS = {
  /** 매칭 가능 앱 리스트 하단 (트래픽 최다) */
  browseList: "",
  /** 앱 상세 댓글 아래 */
  browseDetail: "",
  /** 게시판 리스트 하단 */
  boardList: "",
  /** 게시글 본문 아래 */
  boardDetail: "",
} as const;

export type AdSlotKey = keyof typeof AD_SLOTS;
