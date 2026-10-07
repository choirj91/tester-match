import { CircleAlert, Inbox, LoaderCircle, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** 빈 상태·로딩·오류를 한 모양으로 — 상단 괘선, 아이콘 32px, 세리프 제목, 버튼 하나 */
function StateBlock({
  icon: Icon,
  title,
  description,
  action,
  spin = false,
  role,
}: {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  spin?: boolean;
  role?: "status" | "alert";
}) {
  return (
    <div
      role={role}
      className="flex flex-col items-center gap-3 border-t border-ink-900 px-5 py-12 text-center"
    >
      <Icon
        className={spin ? "size-8 animate-spin text-ink-900" : "size-8 text-ink-900"}
        strokeWidth={1.7}
        aria-hidden="true"
      />
      <p className="m-0 font-display text-xl font-semibold text-ink-900">{title}</p>
      {description && <p className="m-0 max-w-md text-sm text-ink-700">{description}</p>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}

export function EmptyState(props: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return <StateBlock icon={Inbox} {...props} />;
}

export function LoadingState({ title = "불러오는 중입니다" }: { title?: ReactNode }) {
  return <StateBlock icon={LoaderCircle} title={title} spin role="status" />;
}

export function ErrorState(props: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return <StateBlock icon={CircleAlert} role="alert" {...props} />;
}
