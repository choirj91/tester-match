"use client";

import { useState } from "react";
import { AppImportRowSchema, type AppImportRow } from "@/lib/validators/admin-app-import";

type ImportError = { row: number; email?: string; reason: string };
type ImportDuplicate = { row: number; email: string; app_name: string };
type Result = {
  ok: boolean;
  imported?: number;
  skipped?: number;
  total?: number;
  placeholders_created?: number;
  errors?: ImportError[];
  duplicates?: ImportDuplicate[];
  message?: string;
};
type InvalidRow = { rowNum: number; raw: unknown; reason: string };

export const MAX_IMPORT_BATCH_SIZE = 200;

const SAMPLE = `[
  {
    "email": "alice@example.com",
    "app_name": "Alice 앱",
    "store_invite_url": "https://play.google.com/apps/test/com.alice.app/12345",
    "web_invite_url": "https://play.google.com/apps/testing/com.alice.app",
    "required_testers": 12,
    "short_description": "Alice 의 멋진 앱"
  }
]`;

export function chunkRows<T>(rows: T[], size = MAX_IMPORT_BATCH_SIZE): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
}

export function mergeChunkResult(base: Result, chunkResult: Result, rowOffset: number): Result {
  const errors = chunkResult.errors?.map((error) => ({
    ...error,
    row: error.row + rowOffset,
  }));
  const duplicates = chunkResult.duplicates?.map((duplicate) => ({
    ...duplicate,
    row: duplicate.row + rowOffset,
  }));

  return {
    ok: true,
    imported: (base.imported ?? 0) + (chunkResult.imported ?? 0),
    skipped: (base.skipped ?? 0) + (chunkResult.skipped ?? 0),
    total: (base.total ?? 0) + (chunkResult.total ?? 0),
    placeholders_created:
      (base.placeholders_created ?? 0) + (chunkResult.placeholders_created ?? 0),
    errors: [...(base.errors ?? []), ...(errors ?? [])],
    duplicates: [...(base.duplicates ?? []), ...(duplicates ?? [])],
  };
}

function validateRows(input: unknown[]): {
  validRows: AppImportRow[];
  invalidRows: InvalidRow[];
} {
  const validRows: AppImportRow[] = [];
  const invalidRows: InvalidRow[] = [];

  for (let i = 0; i < input.length; i++) {
    const parsed = AppImportRowSchema.safeParse(input[i]);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const path = issue?.path.join(".") ?? "?";
      invalidRows.push({
        rowNum: i + 1,
        raw: input[i],
        reason: `(${path}): ${issue?.message ?? "잘못된 값"}`,
      });
    } else {
      validRows.push(parsed.data);
    }
  }

  return { validRows, invalidRows };
}

export function ImportForm() {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [invalidRows, setInvalidRows] = useState<InvalidRow[]>([]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setParseError(null);
    setResult(null);
    setProgress(null);
    setInvalidRows([]);

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      setParseError(`JSON 파싱 실패: ${String(err)}`);
      return;
    }

    if (!Array.isArray(parsed)) {
      setParseError("JSON 배열 형식이어야 합니다.");
      return;
    }
    if (parsed.length === 0) {
      setParseError("최소 1건 이상 필요합니다.");
      return;
    }

    const { validRows, invalidRows: invalid } = validateRows(parsed);
    setInvalidRows(invalid);

    if (validRows.length === 0) {
      setParseError("유효한 행이 없습니다. 아래 검증 실패 행을 수정 후 다시 시도하세요.");
      return;
    }

    setSubmitting(true);
    try {
      const chunks = chunkRows(validRows);
      let merged: Result = {
        ok: true,
        imported: 0,
        skipped: 0,
        total: 0,
        placeholders_created: 0,
        errors: [],
        duplicates: [],
      };

      for (let i = 0; i < chunks.length; i++) {
        setProgress(`${i + 1}/${chunks.length} 묶음 등록 중`);
        const res = await fetch("/api/admin/apps/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(chunks[i]),
        });
        const data = (await res.json().catch(() => ({}))) as Result;
        if (!res.ok || !data.ok) {
          setResult({
            ok: false,
            message: `${i + 1}/${chunks.length} 묶음 실패: ${data.message ?? "요청 실패"}`,
            imported: merged.imported,
            skipped: merged.skipped,
            total: merged.total,
            placeholders_created: merged.placeholders_created,
            errors: merged.errors,
            duplicates: merged.duplicates,
          });
          return;
        }
        merged = mergeChunkResult(merged, data, i * MAX_IMPORT_BATCH_SIZE);
      }

      setResult(merged);
    } finally {
      setProgress(null);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="import-text" className="text-sm font-semibold text-neutral-900">
            JSON 입력
          </label>
          <button
            type="button"
            onClick={() => setText(SAMPLE)}
            className="text-trust-600 hover:text-trust-700 text-xs"
          >
            예시 채우기
          </button>
        </div>
        <textarea
          id="import-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={16}
          required
          spellCheck={false}
          placeholder="JSON 배열 붙여넣기..."
          className="focus:border-trust-600 focus:ring-trust-500/20 mt-2 w-full resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2.5 font-mono text-xs leading-relaxed shadow-sm placeholder:text-neutral-400 focus:ring-2 focus:outline-none"
        />
      </div>

      {parseError && (
        <p role="alert" className="bg-crimson-500/10 text-crimson-500 rounded-lg px-3 py-2 text-sm">
          {parseError}
        </p>
      )}

      <div className="flex items-center justify-end">
        {progress && <p className="mr-4 text-sm text-neutral-500">{progress}</p>}
        <button
          type="submit"
          disabled={submitting || text.trim().length === 0}
          className="bg-trust-600 hover:bg-trust-700 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
        >
          {submitting ? "등록 중..." : "일괄 등록"}
        </button>
      </div>

      {invalidRows.length > 0 && <ValidationErrorsPanel rows={invalidRows} />}

      {result && <ImportResult result={result} />}
    </form>
  );
}

function ValidationErrorsPanel({ rows }: { rows: InvalidRow[] }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const json = JSON.stringify(
      rows.map((r) => r.raw),
      null,
      2,
    );
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-amber-800">
            검증 실패 — {rows.length}개 행 건너뜀
          </h3>
          <p className="mt-0.5 text-xs text-amber-700">
            아래 행은 등록되지 않았습니다. 복사 후 수정해서 다시 붙여넣으세요.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
        >
          {copied ? "복사됨 ✓" : "JSON 복사"}
        </button>
      </div>

      <ul className="mt-3 space-y-1.5">
        {rows.map((r) => (
          <li key={r.rowNum} className="rounded-lg bg-white px-3 py-2 text-xs">
            <span className="font-semibold text-amber-700">row {r.rowNum}</span>
            {typeof (r.raw as Record<string, unknown>)?.email === "string" && (
              <span className="ml-1.5 text-neutral-500">
                · {String((r.raw as Record<string, unknown>).email)}
              </span>
            )}
            <span className="text-crimson-500 ml-1.5">{r.reason}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ImportResult({ result }: { result: Result }) {
  if (!result.ok) {
    return (
      <div className="bg-crimson-500/10 text-crimson-500 rounded-lg px-4 py-3 text-sm">
        실패: {result.message ?? "unknown"}
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-neutral-900">등록 결과</h3>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
        <Stat label="총 입력" value={result.total ?? 0} />
        <Stat label="등록 성공" value={result.imported ?? 0} tone="text-mint-500" />
        <Stat label="중복 건너뜀" value={result.duplicates?.length ?? 0} />
        <Stat
          label="실패"
          value={result.skipped ?? 0}
          tone={(result.skipped ?? 0) > 0 ? "text-crimson-500" : "text-neutral-700"}
        />
        <Stat label="신규 사용자" value={result.placeholders_created ?? 0} />
      </dl>

      {result.errors && result.errors.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
            DB 오류 상세
          </h4>
          <ul className="mt-2 space-y-1 text-xs">
            {result.errors.map((e, i) => (
              <li key={i} className="bg-crimson-500/5 text-crimson-500 rounded px-2 py-1 font-mono">
                row {e.row}
                {e.email && ` · ${e.email}`} → {e.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.duplicates && result.duplicates.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
            중복 건너뜀 — 같은 소유자·앱 이름·스토어 링크가 이미 등록됨
          </h4>
          <ul className="mt-2 space-y-1 text-xs">
            {result.duplicates.map((d, i) => (
              <li key={i} className="rounded bg-neutral-100 px-2 py-1 font-mono text-neutral-600">
                row {d.row} · {d.email} → {d.app_name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className={`tabular mt-0.5 text-lg font-bold ${tone ?? "text-neutral-900"}`}>{value}</dd>
    </div>
  );
}
