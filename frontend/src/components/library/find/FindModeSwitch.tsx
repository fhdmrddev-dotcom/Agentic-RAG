/**
 * Phase 271 plan 02 (D-01 / UI-SPEC S5) — the Find documents | Ask mode switch on the Documents tab.
 *
 * ⛔ A RADIOGROUP, NEVER A TABLIST. The Library header already owns the page's one tablist, and a
 * second set of tab-role elements would collide with the many suites that query that tablist by name.
 * It would also announce a page section, which this is not: it chooses what the search box does.
 *
 * The track adapts the header's segmented-control look (`LibraryHeaderBar`) but NOT its roles, and
 * spends the accent on the selected segment so the two controls read as different things (the
 * Library tabs stay neutral).
 *
 * Keyboard: roving tabindex (only the checked segment is in the tab order); Left/Right arrows move
 * AND select, wrapping at either end.
 *
 * ⚠ Resetting to Find on page load is the PAGE's job (the mode is not persisted, UI-SPEC S5); this
 * component is props-only and holds no state.
 */
import { useRef } from "react"
import type { KeyboardEvent } from "react"
import { cn } from "@/lib/utils"

export type FindMode = "find" | "ask"

const SEGMENTS: ReadonlyArray<readonly [FindMode, string]> = [
  ["find", "Find documents"],
  ["ask", "Ask"],
]

export interface FindModeSwitchProps {
  value: FindMode
  onChange: (mode: FindMode) => void
}

export function FindModeSwitch({ value, onChange }: FindModeSwitchProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return
    event.preventDefault()
    const step = event.key === "ArrowRight" ? 1 : -1
    const next = (index + step + SEGMENTS.length) % SEGMENTS.length
    onChange(SEGMENTS[next][0])
    refs.current[next]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label="Search mode"
      className="rounded-lg border border-border/60 bg-card/60 p-1 inline-flex gap-0.5"
    >
      {SEGMENTS.map(([mode, label], index) => {
        const checked = value === mode
        return (
          <button
            key={mode}
            ref={(el) => {
              refs.current[index] = el
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(mode)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "rounded-md px-3 py-1 text-xs min-h-[44px] md:min-h-0 md:h-8 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              checked ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
