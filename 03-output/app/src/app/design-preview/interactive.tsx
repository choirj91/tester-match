"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConsentList, Field, Input, Select, Textarea, Checkbox } from "@/components/ui/form";
import { Toast, ToastProvider, useToast } from "@/components/ui/toast";

const CONSENTS = [
  { key: "terms", label: "이용약관 동의", href: "/policies/terms", required: true },
  { key: "refund", label: "환불 정책 확인", href: "/policies/refund", required: true },
  { key: "privacy", label: "개인정보 수집·이용 동의", href: "/policies/privacy", required: true },
];

function ToastButtons() {
  const toast = useToast();
  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="secondary" size="sm" onClick={() => toast("체크인을 저장했습니다")}>
        기본 토스트
      </Button>
      <Button variant="secondary" size="sm" onClick={() => toast("업로드에 실패했습니다", "error")}>
        오류 토스트
      </Button>
    </div>
  );
}

export function InteractivePreview() {
  const [consent, setConsent] = useState<Record<string, boolean>>({});
  return (
    <ToastProvider>
      <div className="grid gap-8 min-[761px]:grid-cols-2">
        <div className="flex flex-col gap-5">
          <Field label="앱 이름" hint="Play 스토어에 보이는 이름">
            {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} placeholder="예: 하루 가계부" />}
          </Field>
          <Field label="비공개 테스트 링크" error="https:// 로 시작하는 주소를 넣어 주세요">
            {({ id, describedBy, invalid }) => (
              <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} defaultValue="play.google.com" />
            )}
          </Field>
          <Field label="카테고리">
            {({ id }) => (
              <Select id={id} defaultValue="tools">
                <option value="tools">도구</option>
                <option value="finance">금융</option>
              </Select>
            )}
          </Field>
          <Field label="한 줄 소개">
            {({ id }) => <Textarea id={id} placeholder="테스터에게 보일 설명" />}
          </Field>
          <Field label="비활성">
            {({ id }) => <Input id={id} disabled defaultValue="수정할 수 없음" />}
          </Field>
          <Checkbox label="알림 받기" defaultChecked />
        </div>
        <div className="flex flex-col gap-5">
          <ConsentList items={CONSENTS} checked={consent} onChange={setConsent} />
          <ToastButtons />
          <div className="flex flex-col items-start gap-2">
            <Toast message="체크인을 저장했습니다" />
            <Toast kind="error" message="업로드에 실패했습니다" />
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}
