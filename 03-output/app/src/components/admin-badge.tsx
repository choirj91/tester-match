/** 관리자 표시 배지 — 댓글 작성자 옆 등. 서버/클라이언트 겸용. */
export function AdminBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full bg-trust-600 px-1.5 py-0.5 text-[9px] font-bold leading-none text-white ${className}`}
    >
      🛡 관리자
    </span>
  );
}
