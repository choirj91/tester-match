import { Coffee, Wallet, type LucideIcon } from "lucide-react";
import { cx } from "@/components/ui/cx";
import type { RewardItemIcon } from "@/lib/rewards";

const ICONS: Readonly<Record<RewardItemIcon, LucideIcon>> = { Coffee, Wallet };

/** 교환 상품 아이콘 — 먹선 사각 틀 안의 lucide 아이콘. 상품 사진·브랜드 로고 대신 쓴다 (ADR-0020) */
export function RewardIcon({ icon, className }: { icon: RewardItemIcon; className?: string }) {
  const Icon = ICONS[icon];
  return (
    <span
      className={cx(
        "flex size-11 shrink-0 items-center justify-center border border-ink-900 bg-white text-ink-900",
        className,
      )}
    >
      <Icon className="size-5" strokeWidth={1.8} aria-hidden="true" />
    </span>
  );
}
