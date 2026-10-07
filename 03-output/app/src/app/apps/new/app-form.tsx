"use client";

import { Check, CircleAlert } from "lucide-react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { TESTER_GROUP_URL, PLAY_GROUP_EMAIL } from "@/lib/tester-group";

type Props = {
  initialNickname: string;
  email: string;
};

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
        text: `"${d.name}" 정보를 채웠습니다. 목표 인원만 확인하면 됩니다.`,
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
      // 공용 테스터 그룹 고정 — 서버에서도 강제 세팅됨
      google_group_url: TESTER_GROUP_URL,
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
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-6">
      {/* Play Store URL 자동 채움 */}
      <section className="border border-ink-900 bg-white p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="ink">자동 채움</Badge>
          <p className="text-[15px] font-bold text-ink-900">Play Store URL 붙여넣기</p>
        </div>
        <p className="mt-1.5 text-sm text-ink-700">
          Play Store 앱 상세 URL 을 붙여넣으면 이름·설명·초대 링크를 자동으로 채웁니다.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input
            type="url"
            aria-label="Play Store URL"
            value={parseUrl}
            onChange={(e) => setParseUrl(e.target.value)}
            placeholder="https://play.google.com/store/apps/details?id=com.example.myapp"
          />
          <Button
            onClick={autofillFromPlayStore}
            loading={parsing}
            className="shrink-0"
          >
            {parsing ? "가져오는 중..." : "자동 채움"}
          </Button>
        </div>
        {parseMsg && (
          <p
            role={parseMsg.tone === "err" ? "alert" : "status"}
            className={`mt-2 flex items-center gap-1.5 text-[13px] font-medium ${
              parseMsg.tone === "ok" ? "text-success-700" : "text-danger-700"
            }`}
          >
            {parseMsg.tone === "ok" ? (
              <Check className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            ) : (
              <CircleAlert className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
            )}
            {parseMsg.text}
          </p>
        )}
      </section>

      <Field label="닉네임" hint="앱 등록 시 발신자 표기명. 변경하면 프로필에도 반영됩니다.">
        {({ id, describedBy }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            name="nickname"
            type="text"
            defaultValue={initialNickname}
            maxLength={32}
            required
          />
        )}
      </Field>

      <Field label="이메일 주소" hint="Google 계정 이메일. 변경할 수 없습니다.">
        {({ id, describedBy }) => (
          <Input id={id} aria-describedby={describedBy} type="email" value={email} disabled />
        )}
      </Field>

      <Field label="앱 이름">
        {({ id }) => (
          <Input
            id={id}
            name="name"
            type="text"
            maxLength={100}
            required
            placeholder="예: 모닝 미라클"
          />
        )}
      </Field>

      <Field
        label="안드로이드 링크"
        hint="Google Play Console에서 발급받은 Closed Testing 초대 링크 (Android 기기용)."
      >
        {({ id, describedBy }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            name="store_invite_url"
            type="url"
            required
            placeholder="https://play.google.com/apps/test/..."
          />
        )}
      </Field>

      <Field label="웹 참여 링크" hint="브라우저에서 바로 참여할 수 있는 웹 옵트인 링크.">
        {({ id, describedBy }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            name="web_invite_url"
            type="url"
            required
            placeholder="https://play.google.com/apps/testing/..."
          />
        )}
      </Field>

      {/* 공용 테스터 그룹 안내 (고정) */}
      <section className="border border-ink-900 bg-white p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="success">자동 설정</Badge>
          <p className="text-[15px] font-bold text-ink-900">Tester Match 공용 테스터 그룹</p>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-ink-700">
          모든 앱은 공용 그룹 <strong className="break-all font-semibold text-ink-900">{PLAY_GROUP_EMAIL}</strong> 을
          사용합니다. 테스터에게는 그룹 1클릭 가입 안내가 자동으로 표시되고, 한 번
          가입한 테스터는 모든 앱에 바로 참여할 수 있습니다.
        </p>
        <div className="mt-4 border-t border-dashed border-ink-900 pt-4">
          <p className="text-sm font-bold text-ink-900">
            등록 전 Play Console 설정 (<span className="tabular">1</span>회, <span className="tabular">1</span>분)
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-ink-700 marker:font-mono">
            <li>Play Console → 테스트 → <strong>비공개 테스트</strong> 트랙 → 테스터 탭</li>
            <li>
              &ldquo;Google 그룹으로 이메일 목록 만들기&rdquo;에{" "}
              <code className="break-all bg-surface-1 px-1 py-0.5 font-mono text-[13px] text-ink-900">
                {PLAY_GROUP_EMAIL}
              </code>{" "}
              추가
            </li>
            <li>저장 → 이후 테스터 관리가 자동화됩니다</li>
          </ol>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => navigator.clipboard.writeText(PLAY_GROUP_EMAIL).catch(() => {})}
          >
            그룹 이메일 복사
          </Button>
        </div>
      </section>

      <Field label="목표 테스터 수" hint="모집 목표 인원. 보통 12명. 0~100명까지 입력할 수 있습니다.">
        {({ id, describedBy }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            name="required_testers"
            type="number"
            min={0}
            max={100}
            defaultValue={12}
            required
            className="font-mono tabular-nums"
          />
        )}
      </Field>

      <Field label="앱 설명" hint="매칭 페이지에 노출됩니다.">
        {({ id, describedBy }) => (
          <Textarea
            id={id}
            aria-describedby={describedBy}
            name="short_description"
            rows={3}
            required
            placeholder="앱의 핵심 가치와 테스터에게 부탁할 내용을 한 문장으로."
            className="resize-y"
          />
        )}
      </Field>

      {error && (
        <p role="alert" className="flex items-center gap-1.5 bg-danger-50 px-3 py-2.5 text-sm text-danger-700">
          <CircleAlert className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="submit" loading={submitting} className="w-full sm:w-auto">
          {submitting ? "등록 중..." : "앱 등록하기"}
        </Button>
      </div>
    </form>
  );
}
