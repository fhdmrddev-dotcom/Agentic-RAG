/**
 * Phase 156 (POLISH-01, Wave 0) — the ONE shared pure engine every later wave
 * transforms `threads` through.
 *
 * Sketch 078-D (`.planning/sketches/078-chat-history-home/index.html`) is the
 * label + boundary source of truth: `groupByDate`/`relDate` at :245-247 define the
 * buckets (Today / Yesterday / Last 7 days / Last 30 days / Older); the vanilla
 * `filt`/`innerHTML` highlight at :380-392 is DELIBERATELY NOT ported literally —
 * that path is an XSS vector on user-controlled thread titles. `HighlightTitle`
 * below re-implements it as JSX text nodes (React auto-escapes each segment).
 *
 * This module is consumed by the chat-history column, the ⌘K palette, and the
 * mobile drawer search so all three share ONE tested predicate — and the XSS
 * control (T-156-01) is built and unit-proven here, before any user-controlled
 * title is ever rendered.
 *
 * File is `.tsx` (not the `.ts` named in the plan): it ships a JSX component, and
 * TypeScript's `tsc` only parses JSX in `.tsx` files — a `.ts` extension would emit
 * net-new build errors. Downstream code imports the extensionless `@/lib/threadGroups`.
 */
import type { Thread, Folder } from "@/types"

export type DateBucket = "Today" | "Yesterday" | "Last 7 days" | "Last 30 days" | "Older"

/** Render order, newest bucket first. `groupByDate` iterates this and drops empties. */
const ORDER: DateBucket[] = ["Today", "Yesterday", "Last 7 days", "Last 30 days", "Older"]

/** Local calendar-day floor (NOT a raw 24h window) — makes "Today"/"Yesterday"
 *  intuitive across a clock boundary rather than an exact-hours-ago count. */
function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/**
 * Calendar-day-aware bucket for a thread's `updated_at`. Boundaries match the
 * sketch labels: 0 → Today, 1 → Yesterday, ≤7 → Last 7 days, ≤30 → Last 30 days,
 * else Older.
 */
export function bucketFor(updatedAtISO: string, now: Date = new Date()): DateBucket {
  const days = Math.floor((startOfDay(now) - startOfDay(new Date(updatedAtISO))) / 86_400_000)
  if (days <= 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days <= 7) return "Last 7 days"
  if (days <= 30) return "Last 30 days"
  return "Older"
}

/**
 * Group threads into date buckets in `ORDER`, DROP empty buckets, and sort items
 * WITHIN each bucket by `updated_at` DESC. The within-bucket sort is defensive —
 * we do not trust the API's row order (Pitfall 3).
 */
export function groupByDate(
  threads: Thread[],
  now: Date = new Date(),
): { label: DateBucket; items: Thread[] }[] {
  const map = new Map<DateBucket, Thread[]>()
  for (const t of threads) {
    const bucket = bucketFor(t.updated_at, now)
    const existing = map.get(bucket)
    if (existing) existing.push(t)
    else map.set(bucket, [t])
  }
  return ORDER.filter((b) => map.get(b)?.length).map((b) => ({
    label: b,
    items: map.get(b)!.slice().sort((a, z) => z.updated_at.localeCompare(a.updated_at)),
  }))
}

/** Case-insensitive substring predicate. Blank/whitespace query → passthrough (true). */
export function matchesTitle(t: Thread, q: string): boolean {
  const needle = q.trim().toLowerCase()
  return !needle || t.title.toLowerCase().includes(needle)
}

/** The row's folder chip label: the folder name, else "Unfiled" (null id), else
 *  "Folder" (an id we can't resolve — the folder is gone or not loaded). */
export function folderLabel(folders: Folder[], folderId: string | null): string {
  if (folderId === null) return "Unfiled"
  return folders.find((f) => f.id === folderId)?.name ?? "Folder"
}

/**
 * Group threads by FOLDER (Phase 156 Task 2 / D-04 — the OPTIONAL Folder view; the
 * locked default stays date, so SC#3 is unaffected). Ordering: known folder names
 * first in the `folders` array order, then any leftover labels (e.g. an unresolved
 * "Folder" orphan), then "Unfiled" (null folder) LAST. Empty groups are dropped and
 * items within a group are sorted `updated_at` DESC — the SAME defensive within-group
 * sort as `groupByDate` (Pitfall 3, we don't trust the API row order).
 *
 * The grouping key reuses `folderLabel`, so a null id → "Unfiled" and a gone/not-loaded
 * id → "Folder": no thread is ever dropped from the view (mirrors the sketch 078
 * `groupByFolder` at index.html:248-249, generalized off the real `folders` list).
 */
export function groupByFolder(
  threads: Thread[],
  folders: Folder[],
): { label: string; items: Thread[] }[] {
  const byLabel = new Map<string, Thread[]>()
  for (const t of threads) {
    const label = folderLabel(folders, t.folder_id)
    const existing = byLabel.get(label)
    if (existing) existing.push(t)
    else byLabel.set(label, [t])
  }
  const order: string[] = []
  for (const f of folders) if (byLabel.has(f.name) && !order.includes(f.name)) order.push(f.name)
  for (const label of byLabel.keys()) if (label !== "Unfiled" && !order.includes(label)) order.push(label)
  if (byLabel.has("Unfiled")) order.push("Unfiled")
  return order.map((label) => ({
    label,
    items: byLabel.get(label)!.slice().sort((a, z) => z.updated_at.localeCompare(a.updated_at)),
  }))
}

/**
 * Safe match-highlight (T-156-01, the ONE real security control this phase adds).
 *
 * Renders the matched slice inside a `<mark>` as JSX TEXT NODES — React auto-escapes
 * every segment, so a title like `<img src=x onerror=alert(1)>` renders as inert
 * visible text, never a live element. NEVER inject raw HTML (React's dangerous
 * set-inner-HTML escape hatch) here — the whole point of this helper is to avoid it.
 *
 * Blank query or no match → the plain title. The Deep Midnight `<mark>` token
 * mirrors the sketch's highlight (index.html:58).
 */
export function HighlightTitle({ title, query }: { title: string; query: string }) {
  const q = query.trim().toLowerCase()
  if (!q) return <>{title}</>
  const i = title.toLowerCase().indexOf(q)
  if (i < 0) return <>{title}</>
  return (
    <>
      {title.slice(0, i)}
      <mark className="bg-primary/25 text-foreground rounded-[3px] px-px">
        {title.slice(i, i + q.length)}
      </mark>
      {title.slice(i + q.length)}
    </>
  )
}
