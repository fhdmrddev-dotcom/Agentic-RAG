/**
 * Phase 304-05 (D-01, D-30; UI-SPEC §1b) — the first row of a new key: what is it for?
 *
 * Two tiles in a `role="radiogroup"`, with the shipped Expires control's roving tabindex: arrows
 * move AND select, and only the chosen tile (or, with nothing chosen, the first choosable one) is
 * in the tab order. Nothing is chosen at rest (A-1: a default would choose for the member).
 *
 * ⚠ D-30: when the deployment can't make AI tool keys (`available` false), this renders NOTHING and
 *   the draft is 293's. When an admin switched MCP off for the org, the MCP tile stays, disabled
 *   (`aria-disabled`, 62% like a dead card), its sub line replaced by the org sentence.
 */
import { useEffect, useId, useRef, type KeyboardEvent } from "react"
import { Bot, Workflow } from "lucide-react"

import { cn } from "@/lib/utils"
import type { ApiKeyKind, McpOff } from "@/lib/api/apiKeys"
import { MCP_KEY_COPY } from "./mcpKeyCopy"
import { mcpOffSentence } from "./McpOffNotice"

const K = MCP_KEY_COPY.kind
const KINDS: readonly ApiKeyKind[] = ["mcp", "workflow"]

export function ApiKeyKindChoice({
  value,
  onChange,
  mcp,
  autoFocus = false,
}: {
  value: ApiKeyKind | null
  /** `how` is `arrow` when an arrow key moved the choice (focus stays on the tiles) and `activate`
   *  for a click, Enter or Space (the draft then moves focus to Label). */
  onChange: (kind: ApiKeyKind, how: "arrow" | "activate") => void
  mcp: { available: boolean; off: McpOff | null }
  /** Focus the first choosable tile on mount (a draft opened from "New key"). */
  autoFocus?: boolean
}) {
  const labelId = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const mcpDisabled = mcp.off !== null
  const choosable = (k: ApiKeyKind) => k === "workflow" || !mcpDisabled
  const firstChoosable = KINDS.findIndex(choosable)
  const tabStop = value !== null && choosable(value) ? KINDS.indexOf(value) : firstChoosable

  useEffect(() => {
    if (autoFocus && mcp.available) refs.current[tabStop]?.focus()
    // Mount only: a later choice moves focus to Label, never back here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!mcp.available) return null

  function onKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0
    if (!delta) return
    e.preventDefault()
    let next = i
    for (let step = 0; step < KINDS.length; step++) {
      next = (next + delta + KINDS.length) % KINDS.length
      if (choosable(KINDS[next])) break
    }
    onChange(KINDS[next], "arrow")
    refs.current[next]?.focus()
  }

  return (
    <div className="grid gap-1">
      <span id={labelId} className="text-sm">
        {K.question}
      </span>
      <div role="radiogroup" aria-labelledby={labelId} className="grid gap-2 sm:grid-cols-2">
        {KINDS.map((k, i) => {
          const selected = value === k
          const disabled = !choosable(k)
          const Icon = k === "mcp" ? Bot : Workflow
          const title = k === "mcp" ? K.mcpTitle : K.workflowTitle
          const sub = k === "mcp" ? (mcp.off ? mcpOffSentence(mcp.off, "tile") : K.mcpSub) : K.workflowSub
          return (
            <button
              key={k}
              ref={(el) => {
                refs.current[i] = el
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-disabled={disabled || undefined}
              tabIndex={i === tabStop ? 0 : -1}
              onClick={() => {
                if (!disabled) onChange(k, "activate")
              }}
              onKeyDown={(e) => onKey(e, i)}
              className={cn(
                "flex min-h-[44px] items-start gap-2 rounded-md border p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-0",
                selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-card hover:bg-muted/40",
                disabled && "cursor-not-allowed opacity-[0.62] hover:bg-card",
              )}
            >
              <Icon className="mt-0.5 h-4 w-4 flex-none text-muted-foreground" aria-hidden="true" />
              <span className="grid gap-1">
                <span className="text-sm">{title}</span>
                <span className={cn("text-xs", disabled ? "text-warning" : "text-muted-foreground")}>{sub}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
