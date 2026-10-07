import { Badge, type BadgeTone } from "@/components/ui/badge";
import { APP_STATUS_LABEL, type AppStatus } from "@/lib/app-status";

/** 앱 상태 → 배지 톤. 글자(APP_STATUS_LABEL)는 그대로, 색만 C안 배지로 */
const APP_STATUS_TONE: Record<AppStatus, BadgeTone> = {
  draft: "outline",
  matching: "ink",
  reviewing: "warning",
  launched: "success",
  completed: "warning", // 레거시 — 심사중
  paused: "outline",
  deleted: "outline",
};

export function AppStatusBadge({ status }: { status: string | null }) {
  const key = (status as AppStatus) ?? "draft";
  const label = APP_STATUS_LABEL[key] ?? APP_STATUS_LABEL.draft;
  const tone = APP_STATUS_TONE[key] ?? "outline";
  return (
    <Badge tone={tone} className="shrink-0">
      {label.text}
    </Badge>
  );
}
