/**
 * Phase 293-04 (D-17) — a key's last calls as a strip of bars, oldest left, newest right.
 *
 * ONE tab stop (roving tabindex, held by the newest call until the person moves): Left/Right walk
 * the bars, Enter/Space opens the one-line detail under the caption. Each bar's accessible name IS
 * that detail sentence, so a screen reader hears the same words the eye reads, and the activity
 * table stays the complete non-visual alternative one click away.
 *
 * Colour is never the only signal: read bars are SHORTER (12px) than start and refused bars (16px),
 * and the caption spells the legend. Visual bar 8px wide inside a 12×24px button (UI-SPEC §Spacing).
 */
import { useRef, useState, type KeyboardEvent } from "react"

import { cn } from "@/lib/utils"
import type { ApiKeyCall } from "@/lib/api/apiKeys"
import { API_KEYS_COPY, fillCopy } from "./apiKeysCopy"
import { callBars, callDetailLine, type BarKind, type CallContext } from "./apiKeyFacts"

const C = API_KEYS_COPY

const BAR_CLASS: Record<BarKind, string> = {
  start: "h-4 bg-primary",
  read: "h-3 bg-muted-foreground/60",
  refused: "h-4 bg-destructive",
}

export function ApiKeyCallStrip({
  calls,
  now,
  label,
  ctx = {},
}: {
  calls: readonly ApiKeyCall[]
  now: Date
  label: string
  ctx?: CallContext
}) {
  const bars = callBars(calls)
  const [focusIdx, setFocusIdx] = useState(() => bars.length - 1)
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  if (bars.length === 0) {
    return <div className="mt-3 font-mono text-xs text-muted-foreground">{C.strip.noCalls}</div>
  }

  const active = Math.min(Math.max(focusIdx, 0), bars.length - 1)

  function move(to: number) {
    const next = Math.min(Math.max(to, 0), bars.length - 1)
    setFocusIdx(next)
    refs.current[next]?.focus()
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    if (e.key === "ArrowRight") {
      e.preventDefault()
      move(i + 1)
    } else if (e.key === "ArrowLeft") {
      e.preventDefault()
      move(i - 1)
    } else if (e.key === "Home") {
      e.preventDefault()
      move(0)
    } else if (e.key === "End") {
      e.preventDefault()
      move(bars.length - 1)
    }
  }

  const detail = openIdx !== null && bars[openIdx] ? callDetailLine(bars[openIdx].call, ctx, now) : null

  return (
    <div className="mt-3">
      <div role="group" aria-label={fillCopy(C.strip.groupLabel, { label })} className="flex h-6 items-end">
        {bars.map((b, i) => {
          const sentence = callDetailLine(b.call, ctx, now)
          return (
            <button
              key={`${b.call.at}-${i}`}
              ref={(el) => {
                refs.current[i] = el
              }}
              type="button"
              data-testid="call-bar"
              data-kind={b.kind}
              aria-label={sentence}
              aria-pressed={openIdx === i}
              tabIndex={i === active ? 0 : -1}
              onFocus={() => setFocusIdx(i)}
              onKeyDown={(e) => onKeyDown(e, i)}
              onClick={() => setOpenIdx(openIdx === i ? null : i)}
              className="flex h-6 w-3 items-end justify-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span aria-hidden="true" data-testid="call-bar-mark" className={cn("block w-2 rounded-[2px]", BAR_CLASS[b.kind])} />
            </button>
          )
        })}
      </div>
      <div data-testid="call-strip-caption" className="mt-1 font-mono text-xs text-muted-foreground">
        {fillCopy(C.strip.caption, { N: bars.length })}
        <span aria-hidden="true" className="text-primary">■</span> {C.strip.legendStart}{" "}
        <span aria-hidden="true" className="text-muted-foreground/60">■</span> {C.strip.legendRead}{" "}
        <span aria-hidden="true" className="text-destructive">■</span> {C.strip.legendRefused}
        {C.strip.tapOne}
      </div>
      {detail !== null && (
        <div
          data-testid="call-detail"
          className="mt-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
        >
          {detail}
        </div>
      )}
    </div>
  )
}
