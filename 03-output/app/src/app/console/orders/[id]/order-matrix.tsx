"use client";

import { Check, X } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/form";
import { CONSOLE_TOTAL_DAYS, type ConsoleSlot, type LogStatus } from "@/lib/console";
import type { ConsoleLogView } from "@/lib/console-data";

type Props = {
  orderId: number;
  isAdmin: boolean;
  slots: ConsoleSlot[];
  logs: ConsoleLogView[];
  dayN: number | null;
  dayLabels: string[] | null;
};

type Cell = { slotId: number; dayN: number };

const DAYS = Array.from({ length: CONSOLE_TOTAL_DAYS }, (_, i) => i + 1);

export function OrderMatrix({ orderId, isAdmin, slots, logs, dayN, dayLabels }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Cell | null>(null);

  const logByKey = new Map<string, ConsoleLogView>();
  for (const l of logs) logByKey.set(`${l.slot_id}:${l.day_n}`, l);

  const selectedLog = selected ? logByKey.get(`${selected.slotId}:${selected.dayN}`) : undefined;
  const selectedSlot = selected ? slots.find((s) => s.id === selected.slotId) : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-x-auto border border-ink-900 bg-white">
        <table className="min-w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-ink-900 bg-surface-1 font-mono text-ink-900">
              <th scope="col" className="sticky left-0 z-10 bg-surface-1 px-3 py-2.5 text-left font-medium">
                테스터
              </th>
              {DAYS.map((d) => (
                <th
                  key={d}
                  scope="col"
                  aria-current={dayN === d ? "date" : undefined}
                  className={`px-1.5 py-2.5 text-center whitespace-nowrap tabular-nums ${dayN === d ? "font-bold underline underline-offset-4" : "font-medium"}`}
                >
                  <div>{d}일차</div>
                  {dayLabels && <div className="font-normal text-ink-600">{dayLabels[d - 1]}</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slots.map((slot) => (
              <tr key={slot.id} className="border-b border-ink-200 last:border-b-0">
                <td className="sticky left-0 z-10 bg-white px-3 py-2">
                  {isAdmin ? (
                    <SlotLabel orderId={orderId} slot={slot} />
                  ) : (
                    <span className="font-semibold text-ink-900">{slot.label}</span>
                  )}
                </td>
                {DAYS.map((d) => {
                  const log = logByKey.get(`${slot.id}:${d}`);
                  const future = dayN !== null && d > dayN;
                  const isSel = selected?.slotId === slot.id && selected?.dayN === d;
                  const tone = log
                    ? log.status === "done"
                      ? "bg-success-700 text-white"
                      : "bg-danger-700 text-white"
                    : "bg-surface-1 text-ink-600";
                  return (
                    <td key={d} className="px-1 py-1.5 text-center">
                      <button
                        type="button"
                        disabled={future && !isAdmin}
                        onClick={() => setSelected({ slotId: slot.id, dayN: d })}
                        title={log ? `${log.status === "done" ? "출석" : "결석"}${log.screenshot_path ? " · 스샷" : ""}` : "기록 없음"}
                        className={`flex h-8 w-8 items-center justify-center font-mono font-medium transition-colors ${tone} ${
                          isSel ? "outline-[3px] outline-offset-1 outline-accent-600" : ""
                        } ${future && !isAdmin ? "cursor-default" : "hover:opacity-80"}`}
                      >
                        {log ? (
                          log.status === "done" ? (
                            <Check className="size-4" strokeWidth={2.2} aria-label="출석" />
                          ) : (
                            <X className="size-4" strokeWidth={2.2} aria-label="결석" />
                          )
                        ) : future ? (
                          ""
                        ) : (
                          "·"
                        )}
                        {log?.screenshot_path && (
                          <span className="sr-only">스크린샷 있음</span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="m-0 text-xs text-ink-600">
        <span className="mr-3 inline-block h-3 w-3 bg-success-700 align-middle" /> 출석 (실행·체크인)
        <span className="mx-3 inline-block h-3 w-3 bg-danger-700 align-middle" /> 결석
        <span className="mx-3 inline-block h-3 w-3 bg-surface-1 align-middle" /> 미기록 — 셀을 누르면
        스크린샷과 코멘트가 열립니다.
      </p>

      {selected && selectedSlot && (
        <DayDetail
          key={`${selected.slotId}:${selected.dayN}`}
          orderId={orderId}
          isAdmin={isAdmin}
          slot={selectedSlot}
          dayN={selected.dayN}
          dateLabel={dayLabels?.[selected.dayN - 1] ?? null}
          log={selectedLog ?? null}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}

function SlotLabel({ orderId, slot }: { orderId: number; slot: ConsoleSlot }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(slot.label);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(`/api/console/orders/${orderId}/slots`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot_id: slot.id, label: value }),
      });
      if (res.ok) {
        setEditing(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="font-semibold text-ink-900 underline decoration-dotted underline-offset-4 hover:text-accent-600"
        title="클릭해서 계정명 수정"
      >
        {slot.label}
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && save()}
        className="w-24 border border-ink-900 px-1.5 py-0.5 text-xs"
        autoFocus
      />
      <button type="button" onClick={save} disabled={busy} className="text-ink-900 underline hover:text-accent-600">
        저장
      </button>
    </span>
  );
}

function DayDetail({
  orderId,
  isAdmin,
  slot,
  dayN,
  dateLabel,
  log,
  onSaved,
}: {
  orderId: number;
  isAdmin: boolean;
  slot: ConsoleSlot;
  dayN: number;
  dateLabel: string | null;
  log: ConsoleLogView | null;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<LogStatus>(log?.status ?? "done");
  const [comment, setComment] = useState(log?.comment ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("slot_id", String(slot.id));
      fd.set("day_n", String(dayN));
      fd.set("status", status);
      fd.set("comment", comment);
      if (file) fd.set("screenshot", file);
      const res = await fetch(`/api/console/orders/${orderId}/logs`, { method: "PUT", body: fd });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (!data.ok) {
        setError(data.message ?? "저장 실패");
        return;
      }
      setFile(null);
      onSaved();
    } catch {
      setError("네트워크 오류");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border border-ink-900 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 font-display text-h3 font-semibold text-ink-900">
          {slot.label} · {dayN}일차{dateLabel ? ` (${dateLabel})` : ""}
        </h2>
        {log ? (
          <Badge tone={log.status === "done" ? "success" : "danger"}>
            {log.status === "done" ? "출석" : "결석"} ·{" "}
            {new Date(log.updated_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
          </Badge>
        ) : (
          <span className="text-xs text-ink-600">기록 없음</span>
        )}
      </div>

      <div className="mt-4 grid gap-5 md:grid-cols-[1fr_320px]">
        <div>
          {log?.screenshot_url ? (
            <a href={log.screenshot_url} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={log.screenshot_url}
                alt={`${slot.label} ${dayN}일차 실행 스크린샷`}
                className="max-h-[480px] border border-ink-900 object-contain"
              />
            </a>
          ) : (
            <div className="flex h-40 items-center justify-center border border-dashed border-ink-900 text-xs text-ink-600">
              스크린샷 없음
            </div>
          )}
          {log?.comment && (
            <p className="m-0 mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-700">{log.comment}</p>
          )}
        </div>

        {isAdmin && (
          <form onSubmit={submit} className="flex flex-col gap-3 bg-surface-1 p-4 text-sm">
            <p className="m-0 text-xs font-medium text-ink-600">운영자 기록</p>
            <label className="block">
              <span className="text-xs text-ink-700">상태</span>
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value as LogStatus)}
                className="mt-1"
              >
                <option value="done">출석 — 실행·체크인 완료</option>
                <option value="missed">결석</option>
              </Select>
            </label>
            <label className="block">
              <span className="text-xs text-ink-700">코멘트</span>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="실행 내용, 발견한 이슈 등"
                className="mt-1"
              />
            </label>
            <label className="block">
              <span className="text-xs text-ink-700">스크린샷 (PNG·JPEG·WebP, 5MB)</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-xs text-ink-900 file:mr-3 file:min-h-11 file:border file:border-ink-900 file:bg-white file:px-3 file:text-xs file:text-ink-900"
              />
            </label>
            {error && <p className="m-0 text-xs font-medium text-danger-700">{error}</p>}
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "저장 중…" : "저장"}
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
