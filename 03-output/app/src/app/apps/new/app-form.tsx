"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  initialNickname: string;
  email: string;
};

const inputClass =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm shadow-sm placeholder:text-neutral-400 focus:border-trust-600 focus:outline-none focus:ring-2 focus:ring-trust-500/20 disabled:bg-neutral-50 disabled:text-neutral-500";

type ParsedApp = {
  package_id: string;
  name: string;
  short_description: string;
  icon_url: string;
  store_invite_url: string;
  web_invite_url: string;
};

export function AppForm({ initialNickname, email }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseUrl, setParseUrl] = useState("");
  const [parseMsg, setParseMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function setField(name: string, value: string) {
    const form = formRef.current;
    if (!form) return;
    const el = form.elements.namedItem(name) as
      | HTMLInputElement
      | HTMLTextAreaElement
      | null;
    if (el && !el.value) el.value = value; // 기존 입력 덮어쓰지 않음
  }

  async function autofillFromPlayStore() {
    setParseMsg(null);
    if (!parseUrl.trim()) {
      setParseMsg({ tone: "err", text: "Play Store URL 을 입력해주세요." });
      return;
    }
    setParsing(true);
    try {
      const res = await fetch("/api/apps/parse-play-store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: parseUrl.trim() }),
      });
      const j = (await res.json()) as
        | { ok: true; data: ParsedApp }
        | { ok: false; message: string };
      if (!res.ok || !j.ok) {
        setParseMsg({ tone: "err", text: !j.ok ? j.message : "파싱 실패" });
        return;
      }
      const d = j.data;
      setField("name", d.name);
      setField("short_description", d.short_description);
      setField("store_invite_url", d.store_invite_url);
      setField("web_invite_url", d.web_invite_url);
      setParseMsg({
        tone: "ok",
        text: `✓ "${d.name}" 정보를 채웠습니다. Google 그룹·목표 인원은 직접 입력해주세요.`,
      });
    } catch {
      setParseMsg({ tone: "err", text: "네트워크 오류. 잠시 후 다시 시도해주세요." });
    } finally {
      setParsing(false);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const body = {
      nickname: String(fd.get("nickname") ?? "").trim(),
      name: String(fd.get("name") ?? "").trim(),
      store_invite_url: String(fd.get("store_invite_url") ?? "").trim(),
      web_invite_url: String(fd.get("web_invite_url") ?? "").trim(),
      google_group_url: String(fd.get("google_group_url") ?? "").trim() || undefined,
      required_testers: Number(fd.get("required_testers") ?? 0),
      short_description: String(fd.get("short_description") ?? "").trim(),
    };

    try {
      const res = await fetch("/api/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok: boolean; id?: number; message?: string };
      if (!res.ok || !data.ok) {
        setError(data.message ?? "등록에 실패했습니다.");
        setSubmitting(false);
        return;
      }
      router.push(data.id ? `/apps/${data.id}?welcome=1` : "/apps");
      router.refresh();
    } catch {
      setError("네트워크 오류. 잠시 후 다시 시도해주세요.");
      setSubmitting(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-5">
      {/* Play Store URL 자동 채움 */}
      <section className="rounded-2xl border border-trust-500/30 bg-trust-50 p-4">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-trust-600 px-2 py-0.5 text-[10px] font-bold text-white">
            자동 채움
          </span>
          <p className="text-sm font-semibold text-neutral-900">
            Play Store URL 붙여넣기
          </p>
        </div>
        <p className="mt-1 text-xs text-neutral-600">
          Play Store 앱 상세 URL 을 붙여넣으면 이름·설명·초대 링크를 자동으로 채웁니다.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="url"
            value={parseUrl}
            onChange={(e) => setParseUrl(e.target.value)}
            placeholder="https://play.google.com/store/apps/details?id=com.example.myapp"
            className={inputClass}
          />
          <button
            type="button"
            onClick={autofillFromPlayStore}
            disabled={parsing}
            className="shrink-0 rounded-lg bg-trust-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-trust-700 disabled:opacity-50"
          >
            {parsing ? "가져오는 중..." : "자동 채움"}
          </button>
        </div>
        {parseMsg && (
          <p
            className={`mt-2 text-xs ${
              parseMsg.tone === "ok"
                ? "font-semibold text-mint-500"
                : "font-semibold text-crimson-500"
            }`}
          >
            {parseMsg.text}
          </p>
        )}
      </section>

      <Field label="닉네임" hint="앱 등록 시 발신자 표기명. 변경하면 프로필에도 반영됩니다.">
        <input
          name="nickname"
          type="text"
          defaultValue={initialNickname}
          maxLength={32}
          required
          className={inputClass}
        />
      </Field>

      <Field label="이메일 주소" hint="Google 계정 이메일. 변경할 수 없습니다.">
        <input type="email" value={email} disabled className={inputClass} />
      </Field>

      <Field label="앱 이름">
        <input
          name="name"
          type="text"
          maxLength={100}
          required
          placeholder="예: 모닝 미라클"
          className={inputClass}
        />
      </Field>

      <Field
        label="안드로이드 링크"
        hint="Google Play Console에서 발급받은 Closed Testing 초대 링크 (Android 기기용)."
      >
        <input
          name="store_invite_url"
          type="url"
          required
          placeholder="https://play.google.com/apps/test/..."
          className={inputClass}
        />
      </Field>

      <Field
        label="웹 참여 링크"
        hint="브라우저에서 바로 참여할 수 있는 웹 옵트인 링크."
      >
        <input
          name="web_invite_url"
          type="url"
          required
          placeholder="https://play.google.com/apps/testing/..."
          className={inputClass}
        />
      </Field>

      <Field
        label="Google 그룹 URL (선택)"
        hint="Google Play Closed Testing은 Google 그룹에 먼저 가입해야 초대 링크를 사용할 수 있습니다. 그룹 URL을 입력하면 테스터에게 가입 안내가 먼저 표시됩니다."
      >
        <input
          name="google_group_url"
          type="url"
          placeholder="https://groups.google.com/g/your-group-name"
          className={inputClass}
        />
      </Field>

      <Field
        label="목표 테스터 수"
        hint="모집 목표 인원. 보통 12명. 0~100명까지 입력할 수 있습니다."
      >
        <input
          name="required_testers"
          type="number"
          min={0}
          max={100}
          defaultValue={12}
          required
          className={`${inputClass} tabular`}
        />
      </Field>

      <Field label="앱 설명" hint="매칭 페이지에 노출됩니다.">
        <textarea
          name="short_description"
          rows={3}
          required
          placeholder="앱의 핵심 가치와 테스터에게 부탁할 내용을 한 문장으로."
          className={`${inputClass} resize-y`}
        />
      </Field>

      {error && (
        <p role="alert" className="rounded-lg bg-crimson-500/10 px-3 py-2 text-sm text-crimson-500">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-trust-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-trust-700 disabled:opacity-50"
        >
          {submitting ? "등록 중..." : "앱 등록하기"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-neutral-900">{label}</span>
      {hint && <span className="mt-0.5 block text-xs text-neutral-500">{hint}</span>}
      <div className="mt-2">{children}</div>
    </label>
  );
}
