/**
 * Cursor pagination yordamchilari — offset TAQIQLANGAN (Master qoida).
 * Cursor = oxirgi yozuv id'si (uuid), createdAt DESC + id tie-break.
 */

export interface CursorPage<T> {
  data: T[];
  meta: { nextCursor: string | null; limit: number };
}

export function buildCursorPage<T extends { id: string }>(
  rows: T[],
  limit: number,
): CursorPage<T> {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  return {
    data,
    meta: { nextCursor: hasMore ? data[data.length - 1].id : null, limit },
  };
}
