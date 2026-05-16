"use client";

import { useState } from "react";

export function CostCalculator() {
  const [testers, setTesters] = useState(12);
  const price = testers * 1000;

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h3 className="text-base font-semibold text-neutral-900">예상 비용 계산기</h3>
      <p className="mt-1 text-xs text-neutral-500">필요한 테스터 수를 설정해보세요</p>

      <div className="mt-5">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-neutral-700">테스터 수</label>
          <span className="tabular text-lg font-bold text-trust-600">{testers}명</span>
        </div>
        <input
          type="range"
          min={1}
          max={50}
          value={testers}
          onChange={(e) => setTesters(Number(e.target.value))}
          className="mt-2 w-full accent-trust-600"
        />
        <div className="flex justify-between text-xs text-neutral-400">
          <span>1명</span>
          <span>50명</span>
        </div>
      </div>

      <div className="mt-6 space-y-3 rounded-xl bg-neutral-50 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-600">개발자 결제 금액</span>
          <span className="tabular font-bold text-neutral-900">
            {testers}명 × 1,000원 ={" "}
            <span className="text-trust-600">{price.toLocaleString("ko-KR")}원</span>
          </span>
        </div>
        <div className="flex items-center justify-between border-t border-neutral-200 pt-3 text-sm">
          <span className="text-neutral-600">테스터 1인당 보상</span>
          <span className="tabular font-bold text-spark-600">출시 완료 시 +100원</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-600">테스터 전체 보상 합계</span>
          <span className="tabular font-medium text-neutral-500">
            {testers}명 × 100원 = {(testers * 100).toLocaleString("ko-KR")}원
          </span>
        </div>
      </div>

      <p className="mt-3 text-xs text-neutral-400">
        * 나머지 {(price - testers * 100).toLocaleString("ko-KR")}원은 플랫폼 운영 및 매칭 서비스 비용입니다.
      </p>
    </div>
  );
}
