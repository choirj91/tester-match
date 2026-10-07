"use client";

import { Check, CircleAlert } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "./cx";

const TOAST_MS = 4000;

type ToastKind = "default" | "error";
type ToastState = { id: number; kind: ToastKind; message: string };

const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

/** 한 번에 하나만 — 모바일 하단 중앙(탭 바 위), 데스크톱 우상단. 4초 후 사라진다 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, kind: ToastKind = "default") => {
    setToast({ id: Date.now(), kind, message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), TOAST_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [toast]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-[calc(72px+env(safe-area-inset-bottom))] z-[60] flex justify-center min-[761px]:inset-x-auto min-[761px]:top-20 min-[761px]:right-6 min-[761px]:bottom-auto"
      >
        {toast && <Toast key={toast.id} kind={toast.kind} message={toast.message} />}
      </div>
    </ToastContext.Provider>
  );
}

export function Toast({ kind = "default", message }: { kind?: ToastKind; message: string }) {
  const Icon = kind === "error" ? CircleAlert : Check;
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={cx(
        "pointer-events-auto flex max-w-sm items-center gap-2.5 px-4 py-3 text-sm text-white",
        kind === "error" ? "bg-danger-700" : "bg-ink-900",
      )}
    >
      <Icon className="size-[18px] shrink-0" strokeWidth={2} aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
