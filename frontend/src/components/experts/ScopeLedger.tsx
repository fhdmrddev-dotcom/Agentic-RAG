/**
 * Phase 267 plan 03 (D-267-27, UI-SPEC §5.2) — the Will / won't ledger.
 *
 * ⛔ ONE PAYLOAD, TWO LISTS. This leaf renders the columns it is GIVEN and computes nothing about
 * an Expert: which items belong in which column is decided by one pure selector
 * (`connectionLedgerColumns` in `catalog/expertCatalog.ts` for connections; the restricted-cost
 * preview selector for `Will use` / `Won't use`), built from one server payload. A ledger whose two
 * sides were computed by two independent strings could disagree, and that is the defect the sketch's
 * build obligation names.
 *
 * ⛔ EVERY WORD IS VISIBLE AT REST. No hover, no disclosure: each item truncates, but its full text
 * is also its `title` and its accessible name, so truncation never hides the only copy.
 *
 * Presentation only, and the one thing it decides: more than {@link LEDGER_VISIBLE} items render
 * that many, then `and {k} more` — where k also counts a column's own `more` (a server total that
 * the item list does not carry, e.g. an excluded-document count). It never re-derives a count
 * from the items alone.
 */
import { useId } from "react"
import { EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { UNNAMEABLE_FOLDER } from "./catalog/ExpertDetailModal"
import { LEDGER_COPY } from "./catalog/expertCatalog"

export interface LedgerItem {
  label: string
  /** A folder the caller cannot resolve — rendered as the shipped phrase, never a blank. */
  unnameable?: boolean
  /** 267-REVIEW WR-08: a promise the column must always show (D-267-19's `Chat attachments`). It
   *  is never counted into `and {k} more`, and renders after the truncated list. */
  pinned?: boolean
}

export interface LedgerColumn {
  tone: "yes" | "no"
  heading: string
  items: LedgerItem[]
  /** Items beyond `items` that the payload counted but did not list. */
  more?: number
}

/** How many items a column shows before `and {k} more`. */
export const LEDGER_VISIBLE = 5

function Column({ column }: { column: LedgerColumn }) {
  const headingId = useId()
  // 267-REVIEW WR-08: pinned items sit outside the truncation, so they are never an "and k more".
  const regular = column.items.filter((i) => !i.pinned)
  const pinned = column.items.filter((i) => i.pinned)
  const shown = regular.slice(0, LEDGER_VISIBLE)
  const overflow = Math.max(0, regular.length - LEDGER_VISIBLE) + (column.more ?? 0)
  return (
    <div
      data-testid={`scope-ledger-col-${column.tone}`}
      className={cn(
        "min-w-0 rounded-lg border px-3 py-2",
        column.tone === "yes"
          ? "border-emerald-500/25 bg-emerald-500/[0.08]"
          : "border-rose-500/25 bg-rose-500/10",
      )}
    >
      <p
        id={headingId}
        className="text-[11px] font-semibold uppercase leading-snug tracking-wider text-muted-foreground"
      >
        {column.heading}
      </p>
      <ul aria-labelledby={headingId} className="mt-1 space-y-1">
        {shown.map((item, i) => {
          const text = item.unnameable ? UNNAMEABLE_FOLDER : item.label
          return (
            <li key={`${text}-${i}`} className="flex min-w-0 items-center gap-1 text-xs leading-relaxed">
              {item.unnameable && <EyeOff className="h-3 w-3 flex-none text-muted-foreground" />}
              <span
                title={text}
                className={cn(
                  "truncate",
                  item.unnameable ? "italic text-muted-foreground" : "text-foreground",
                )}
              >
                {text}
              </span>
            </li>
          )
        })}
        {overflow > 0 && (
          <li className="text-xs leading-relaxed text-muted-foreground">
            {LEDGER_COPY.more(overflow)}
          </li>
        )}
        {pinned.map((item, i) => (
          <li key={`pinned-${item.label}-${i}`} className="flex min-w-0 items-center gap-1 text-xs leading-relaxed">
            <span title={item.label} className="truncate text-foreground">
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ScopeLedger({ columns }: { columns: LedgerColumn[] }) {
  if (columns.length === 0) return null
  return (
    <div
      data-testid="scope-ledger"
      className={cn("mt-3 grid grid-cols-1 gap-2", columns.length > 1 && "sm:grid-cols-2")}
    >
      {columns.map((c) => (
        <Column key={`${c.tone}-${c.heading}`} column={c} />
      ))}
    </div>
  )
}
