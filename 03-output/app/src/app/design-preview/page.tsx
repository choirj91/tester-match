import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { AppCard } from "@/components/ui/app-card";
import { Badge, PaymentPendingBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { MoneyUseBar } from "@/components/ui/money-use-bar";
import { Notice } from "@/components/ui/notice";
import { Receipt, ReceiptDivider, ReceiptRow, ReceiptRows } from "@/components/ui/receipt";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import { StatTile, StatTiles } from "@/components/ui/stat-tile";
import { Steps } from "@/components/ui/steps";
import { Table } from "@/components/ui/table";
import { InteractivePreview } from "./interactive";

export const metadata = { title: "디자인 미리보기", robots: { index: false } };

/** 개발 전용 — Design C 컴포넌트를 상태별로 나열한다. 운영에서는 404 */
export default function DesignPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const refundRows = [
    { id: 1, when: "충원 기간(결제 후 7일) 안에 못 채운 시트", amount: "1,100" },
    { id: 2, when: "충원 마감 후 테스터가 이탈한 시트", amount: "1,100" },
    { id: 3, when: "14일을 완주한 시트", amount: "0" },
  ];

  return (
    <main>
      <SiteHeader user={null} />
      <div className="mx-auto flex max-w-[1200px] flex-col gap-14 px-5 py-12">
        <h1 className="m-0 font-display text-h1 font-semibold">Design C 컴포넌트</h1>

        <Section title="5.1 Button">
          {(["primary", "secondary", "text"] as const).map((v) => (
            <div key={v} className="flex flex-wrap items-center gap-3">
              <Button variant={v} size="lg">{v} lg</Button>
              <Button variant={v}>{v} md</Button>
              <Button variant={v} size="sm">{v} sm</Button>
              <Button variant={v} disabled>disabled</Button>
              <Button variant={v} loading>저장하기</Button>
              <ButtonLink variant={v} href="#">링크</ButtonLink>
            </div>
          ))}
        </Section>

        <Section title="5.2 Badge">
          <div className="flex flex-wrap gap-2">
            <Badge tone="accent">급구</Badge>
            <Badge tone="ink">맞테스트</Badge>
            <Badge tone="outline">유료 시트 3</Badge>
            <Badge tone="success">완주</Badge>
            <Badge tone="warning">확인 대기</Badge>
            <Badge tone="danger">이탈</Badge>
            <PaymentPendingBadge />
          </div>
        </Section>

        <Section title="5.3 Receipt · 5.4 MoneyUseBar">
          <Receipt title="급구 · 유료 테스터" badge={<PaymentPendingBadge />} meta="판매자 낰낰컴퍼니 · 부가세 포함 가격" footer="판매·환불 주체는 낰낰컴퍼니입니다." className="max-w-[420px]">
            <ReceiptDivider />
            <ReceiptRows>
              <ReceiptRow label="테스터 1명" value="1,100원" />
              <ReceiptRow label="합계" value="15,400원" strong />
            </ReceiptRows>
            <ReceiptDivider />
            <MoneyUseBar />
            <ReceiptDivider />
            <ReceiptRows className="text-[13px]">
              <ReceiptRow label="못 채운 시트" value="환불" tone="accent" />
            </ReceiptRows>
          </Receipt>
        </Section>

        <Section title="5.5 StatTile">
          <StatTiles>
            <StatTile rule label="품앗이" value="무료" />
            <StatTile rule label="급구 · 테스터 1명" value="1,100원" />
            <StatTile rule label="완주 기준" value="14일 중 12일" />
          </StatTiles>
        </Section>

        <Section title="5.6 Notice">
          <Notice kind="info" title="충원 기간">결제 후 7일 동안 테스터를 채웁니다.</Notice>
          <Notice kind="caution" title="체크인을 놓쳤습니다">오늘 자정 전에 스크린샷을 올려 주세요.</Notice>
          <Notice kind="legal">급구(유료 테스터)의 판매·환불 주체는 낰낰컴퍼니입니다.</Notice>
        </Section>

        <Section title="5.7 AppCard">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] gap-4">
            <AppCard
              name="하루 가계부"
              badges={<><Badge tone="accent">급구</Badge><Badge tone="outline">유료 시트 3</Badge></>}
              description="지출을 한 줄로 적는 가계부"
              meta="테스터 8/12 · 남은 6일"
              action={<ButtonLink variant="secondary" size="sm" href="#">참여하기</ButtonLink>}
              highlighted
            />
            <AppCard
              name="산책 기록"
              badges={<Badge tone="ink">맞테스트</Badge>}
              description="걸은 길을 지도에 남깁니다"
              meta="테스터 11/12 · 남은 2일"
              action={<ButtonLink variant="secondary" size="sm" href="#">참여하기</ButtonLink>}
            />
          </div>
        </Section>

        <Section title="5.8 Steps">
          <Steps items={[
            { title: "앱 등록", desc: "비공개 테스트 링크와 간단한 설명을 올립니다." },
            { title: "매칭 · 급구", desc: "품앗이로 모으고, 모자란 인원은 급구로 채웁니다." },
            { title: "14일 체크인", desc: "테스터가 매일 1분, 스크린샷으로 증빙합니다." },
            { title: "출시 · 맞테스트", desc: "나를 도운 개발자의 앱도 테스트해 줍니다." },
          ]} />
        </Section>

        <Section title="5.9 폼 · 5.12 Toast">
          <InteractivePreview />
        </Section>

        <Section title="5.10 Table">
          <Table
            caption="환불 기준"
            columns={[
              { key: "when", header: "경우", cell: (r) => r.when },
              { key: "amount", header: "환불(원)", cell: (r) => r.amount, numeric: true },
            ]}
            rows={refundRows}
            rowKey={(r) => r.id}
          />
        </Section>

        <Section title="5.11 Empty · Loading · Error">
          <EmptyState title="아직 참여한 테스트가 없습니다" description="매칭 가능한 앱을 골라 보세요." action={<ButtonLink href="#">매칭 목록 보기</ButtonLink>} />
          <LoadingState />
          <ErrorState title="불러오지 못했습니다" description="잠시 후 다시 시도해 주세요." action={<Button variant="secondary">다시 시도</Button>} />
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-ink-900 pt-5">
      <h2 className="m-0 font-mono text-sm font-medium text-ink-600">{title}</h2>
      {children}
    </section>
  );
}
