"use client";

import { useState } from "react";

type ImportError = { row: number; email?: string; reason: string };
type Result = {
  ok: boolean;
  imported?: number;
  skipped?: number;
  total?: number;
  placeholders_created?: number;
  errors?: ImportError[];
  message?: string;
};

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

export function ImportForm() {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setParseError(null);
    setResult(null);

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      setParseError(`JSON 파싱 실패: ${String(err)}`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/apps/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = (await res.json().catch(() => ({}))) as Result;
      setResult(res.ok ? data : { ok: false, message: data.message ?? "요청 실패" });
    } finally {
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
            className="text-xs text-trust-600 hover:text-trust-700"
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
          className="mt-2 w-full resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2.5 font-mono text-xs leading-relaxed shadow-sm placeholder:text-neutral-400 focus:border-trust-600 focus:outline-none focus:ring-2 focus:ring-trust-500/20"
        />
      </div>

      {parseError && (
        <p role="alert" className="rounded-lg bg-crimson-500/10 px-3 py-2 text-sm text-crimson-500">
          {parseError}
        </p>
      )}

      <div className="flex items-center justify-end">
        <button
          type="submit"
          disabled={submitting || text.trim().length === 0}
          className="rounded-lg bg-trust-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-trust-700 disabled:opacity-50"
        >
          {submitting ? "등록 중..." : "일괄 등록"}
        </button>
      </div>

      {result && <ImportResult result={result} />}
    </form>
  );
}

function ImportResult({ result }: { result: Result }) {
  if (!result.ok) {
    return (
      <div className="rounded-lg bg-crimson-500/10 px-4 py-3 text-sm text-crimson-500">
        실패: {result.message ?? "unknown"}
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-neutral-900">등록 결과</h3>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Stat label="총 입력" value={result.total ?? 0} />
        <Stat label="등록 성공" value={result.imported ?? 0} tone="text-mint-500" />
        <Stat
          label="실패"
          value={result.skipped ?? 0}
          tone={(result.skipped ?? 0) > 0 ? "text-crimson-500" : "text-neutral-700"}
        />
        <Stat label="신규 사용자" value={result.placeholders_created ?? 0} />
      </dl>

      {result.errors && result.errors.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            오류 상세
          </h4>
          <ul className="mt-2 space-y-1 text-xs">
            {result.errors.map((e, i) => (
              <li key={i} className="rounded bg-crimson-500/5 px-2 py-1 font-mono text-crimson-500">
                row {e.row}
                {e.email && ` · ${e.email}`} → {e.reason}
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
      <dd className={`mt-0.5 text-lg font-bold tabular ${tone ?? "text-neutral-900"}`}>{value}</dd>
    </div>
  );
}
