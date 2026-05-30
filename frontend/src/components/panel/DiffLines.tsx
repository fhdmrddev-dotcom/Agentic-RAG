/**
 * Phase 087 Plan 04 — shared in-column diff renderer (PANEL-07, sketch 005 /
 * file-browser-and-diff.md D3). Presentational ONLY: it takes the already-parsed
 * DiffLine[] and renders the unified +/− diff with a fixed 16px sign gutter,
 * horizontal scroll (never wrap — the diff-illegibility guard), and the calm
 * truncation notice. Used by BOTH VersionDiff (in-column) and DiffExpandOverlay
 * (wide) so the ⤢ overlay shows the EXACT same payload — no second fetch (D4).
 *
 * Color language (LOCKED): add → green (--success), del → red (--destructive),
 * hunk → primary indigo (--primary), context → dim. Tokens mirror index.css.
 *
 * SECURITY (T-087-08): every line is rendered as a React TEXT child ({line.text})
 * — never dangerouslySetInnerHTML. A diff line containing markup renders as
 * literal text.
 */
import { cn } from "@/lib/utils"
import type { DiffLine } from "@/lib/diffParse"

export interface DiffLinesProps {
  lines: DiffLine[]
  truncated: boolean
  /** Optional className for the scroll container. */
  className?: string
}

/** The "diff truncated at 500 lines" notice (Pitfall 4 — surfaced honestly). */
function TruncationNotice() {
  return (
    <div
      role="note"
      className="border-t border-border/60 bg-[hsl(var(--warning)/0.12)] px-3 py-1.5 font-mono text-[11px] text-[hsl(var(--warning))]"
    >
      diff truncated at 500 lines
    </div>
  )
}

export function DiffLines({ lines, truncated, className }: DiffLinesProps) {
  return (
    <div className={cn("min-w-0", className)}>
      <div
        className="overflow-x-auto py-1.5 pb-4 font-mono text-[13px] leading-[1.6]"
        // never wrap — let the diff scroll-x so a wrapped addition can't read
        // like a deletion (file-browser-and-diff.md "What to Avoid").
      >
        {lines.map((line, i) => {
          if (line.kind === "header") {
            // file headers (--- vN / +++ vN) render as quiet meta, skip-worthy.
            return (
              <div
                key={i}
                className="whitespace-pre px-1.5 text-panel-muted-foreground-dim"
              >
                {line.text}
              </div>
            )
          }
          if (line.kind === "hunk") {
            return (
              <div
                key={i}
                className="whitespace-pre bg-[hsl(var(--primary)/0.12)] px-1.5 py-1 text-[hsl(var(--primary))]"
              >
                {line.text}
              </div>
            )
          }
          const isAdd = line.kind === "add"
          const isDel = line.kind === "del"
          return (
            <div
              key={i}
              className={cn(
                "flex whitespace-pre px-1.5",
                isAdd && "bg-[hsl(var(--success)/0.14)]",
                isDel && "bg-[hsl(var(--destructive)/0.14)]",
                !isAdd && !isDel && "text-panel-muted-foreground",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "w-4 flex-none select-none text-panel-muted-foreground-dim",
                  isAdd && "text-[hsl(var(--success))]",
                  isDel && "text-[hsl(var(--destructive))]",
                )}
              >
                {line.sign ?? " "}
              </span>
              <span
                className={cn(
                  "min-w-0",
                  isAdd && "text-[hsl(var(--success))]",
                  isDel && "text-[hsl(var(--destructive))]",
                  !isAdd && !isDel && "text-foreground/90",
                )}
              >
                {line.text}
              </span>
            </div>
          )
        })}
      </div>
      {truncated && <TruncationNotice />}
    </div>
  )
}

export default DiffLines
