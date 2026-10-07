import type { ReactNode } from "react";
import { cx } from "./cx";

export type Column<Row> = {
  key: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  /** 숫자 열 — 오른쪽 정렬 mono */
  numeric?: boolean;
};

/** 표 — 모바일에서는 이 상자 안에서만 가로 스크롤한다 (페이지는 스크롤하지 않는다) */
export function Table<Row>({
  columns,
  rows,
  rowKey,
  caption,
  empty,
}: {
  columns: ReadonlyArray<Column<Row>>;
  rows: ReadonlyArray<Row>;
  rowKey: (row: Row) => string | number;
  caption?: ReactNode;
  empty?: ReactNode;
}) {
  return (
    <div className="w-full overflow-x-auto border border-ink-900">
      <table className="w-full border-collapse text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="bg-surface-1">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cx(
                  "border-b border-ink-900 px-3 py-2.5 font-mono text-xs font-medium whitespace-nowrap text-ink-900",
                  c.numeric ? "text-right" : "text-left",
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && empty ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-6 text-center text-ink-600">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)} className="border-b border-ink-200 last:border-b-0">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cx(
                      "px-3 py-2.5 text-ink-900",
                      c.numeric && "text-right font-mono whitespace-nowrap tabular-nums",
                    )}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
