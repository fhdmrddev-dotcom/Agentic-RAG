/**
 * 284-REVIEW CR-01 — the ONE clamp every paged list uses (the browse pager in `LibraryPage` and
 * IngestionTab's three status lists).
 *
 * A list can shrink under an open page: Include archived turned off, a document deleted in
 * another tab, the retention sweep. The server answers a page past the end with
 * `{documents: [], total}` (it used to be PostgREST's 416 → a 500, and "Try again" re-asked the
 * same impossible page forever); this moves the person back onto the last page that exists.
 *
 * A pure function — no React, no I/O — so both callers share the exact rule.
 */

/** The offset to show for `total` rows at `pageSize`: `offset` itself while it is inside the
 *  list, else the first row of the LAST page; `0` for an empty list. */
export function clampPageOffset(offset: number, total: number, pageSize: number): number {
  if (total <= 0) return 0
  if (offset < total) return offset
  return Math.floor((total - 1) / pageSize) * pageSize
}
