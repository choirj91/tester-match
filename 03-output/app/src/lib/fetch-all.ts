/**
 * PostgREST 는 요청당 최대 1,000행 반환.
 * 1,000행씩 range 페이지네이션으로 전체를 모은다.
 */
export async function fetchAll<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null }>,
): Promise<T[]> {
  const pageSize = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data } = await query(from, from + pageSize - 1);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return rows;
}
