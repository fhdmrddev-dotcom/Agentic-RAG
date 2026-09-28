/**
 * Phase 268 (UI-SPEC §5.6, D-268-08) — the Expert pill group on /admin/spend's ribbon, and the
 * ONE pill style all three ribbon groups share (§9-D8).
 *
 * ⛔ One selection, one state, owned by the page. This leaf renders and reports; it never
 * fetches. The page passes the same value to BOTH spend calls — the 257 "two dialects" lesson.
 *
 * Light-theme contract (§4.3): every hue text step is a light/dark PAIR on ONE source line,
 * because `expertThemeContrast.test.tsx` fences this file line by line.
 */
import React from "react"
import { ChevronDown, Sparkles } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ExpertSpendLine } from "@/types/spend"
import { EXPERT_SPEND_COPY as C } from "./expertSpendCopy"

const PILL_BASE = "px-2.5 py-1 rounded-md font-mono transition-colors min-h-[44px] sm:min-h-0 inline-flex items-center gap-1"
const PILL_ON = "bg-indigo-500/15 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-600/40 dark:border-indigo-500/40 font-semibold"
const PILL_OFF = "text-muted-foreground hover:text-foreground hover:bg-card"

/** The ribbon's one pill style — Time, Expert and Coverage read as one control set. */
export function filterPillClass(on: boolean): string {
  return `${PILL_BASE} ${on ? PILL_ON : PILL_OFF}`
}

/** Above this many Expert pills, the top `VISIBLE_EXPERTS` show and the rest go under More. */
const MAX_INLINE_EXPERTS = 6
const VISIBLE_EXPERTS = 5

/** The words one line is known by, everywhere on the page. */
export function expertLineLabel(line: Pick<ExpertSpendLine, "key" | "name" | "deleted">): string {
  if (line.key === "none") return C.noExpert
  if (line.key === "unrecorded") return C.notRecorded
  if (line.deleted || !line.name) return `${C.deletedExpert} ${line.key.slice(0, 8)}`
  return line.name
}

function PillContent({ line }: { line: Pick<ExpertSpendLine, "key" | "name" | "deleted"> }) {
  if (line.key === "none" || line.key === "unrecorded") {
    return <span className="italic">{expertLineLabel(line)}</span>
  }
  if (line.deleted || !line.name) {
    return (
      <>
        {C.deletedExpert}{" "}
        <span className="font-mono text-muted-foreground font-normal">{line.key.slice(0, 8)}</span>
      </>
    )
  }
  return <>{line.name}</>
}

interface ExpertFilterPillsProps {
  /** The window's lines, or `null` while loading / after a failed load. */
  lines: ExpertSpendLine[] | null
  selected: string | null
  /** The selected line's label, remembered by the page so it survives a window with no runs. */
  selectedLabel: string | null
  onSelect: (key: string | null) => void
}

export const ExpertFilterPills: React.FC<ExpertFilterPillsProps> = ({
  lines,
  selected,
  selectedLabel,
  onSelect,
}) => {
  const selectedLine: ExpertSpendLine | null = selected
    ? {
        key: selected,
        expertId: null,
        name: selectedLabel,
        deleted: false,
        scopeMode: null,
        runCount: 0,
        inputTokens: 0,
        outputTokens: 0,
        spendUsd: 0,
        unratedCount: 0,
      }
    : null

  const pill = (line: Pick<ExpertSpendLine, "key" | "name" | "deleted">) => {
    const on = selected === line.key
    return (
      <button
        key={line.key}
        type="button"
        aria-pressed={on}
        data-testid={`spend-expert-pill-${line.key}`}
        onClick={() => onSelect(line.key)}
        className={filterPillClass(on)}
      >
        <PillContent line={line} />
      </button>
    )
  }

  let body: React.ReactNode
  if (lines === null) {
    // Loading or failed: never an empty group with no way back (§5.6).
    body = selectedLine ? pill(selectedLine) : null
  } else {
    const experts = lines.filter((l) => l.key !== "none" && l.key !== "unrecorded")
    const none = lines.find((l) => l.key === "none")
    const unrecorded = lines.find((l) => l.key === "unrecorded" && l.runCount > 0)
    // A selected Expert with no runs in this window stays visible (§5.6).
    const selectedMissing =
      selectedLine && !lines.some((l) => l.key === selected) && selected !== "none"
    const allExperts = selectedMissing && selected !== "unrecorded" ? [...experts, selectedLine!] : experts

    let inline = allExperts
    let overflow: ExpertSpendLine[] = []
    if (allExperts.length > MAX_INLINE_EXPERTS) {
      inline = allExperts.slice(0, VISIBLE_EXPERTS)
      overflow = allExperts.slice(VISIBLE_EXPERTS)
      const promoted = overflow.find((l) => l.key === selected)
      if (promoted) {
        inline = [...inline, promoted]
        overflow = overflow.filter((l) => l.key !== selected)
      }
    }

    body = (
      <>
        {inline.map(pill)}
        {overflow.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className={filterPillClass(false)} data-testid="spend-expert-pill-more">
                {C.more}
                <ChevronDown className="h-3 w-3" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-w-[calc(100vw-2rem)]">
              <DropdownMenuRadioGroup value={selected ?? ""} onValueChange={(v) => onSelect(v)}>
                {overflow.map((l) => (
                  <DropdownMenuRadioItem key={l.key} value={l.key} className="min-h-[44px] sm:min-h-0 font-mono text-xs">
                    <PillContent line={l} />
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {pill(none ?? { key: "none", name: null, deleted: false })}
        {unrecorded
          ? pill(unrecorded)
          : selected === "unrecorded" && selectedLine
            ? pill(selectedLine)
            : null}
      </>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5" data-testid="spend-expert-filter">
      <span className="text-muted-foreground mr-1 flex items-center gap-1 font-mono">
        <Sparkles className="h-3 w-3 text-violet-600 dark:text-violet-400" aria-hidden="true" /> {C.ribbonLabel}
      </span>
      <button
        type="button"
        aria-pressed={selected === null}
        data-testid="spend-expert-pill-all"
        onClick={() => onSelect(null)}
        className={filterPillClass(selected === null)}
      >
        {C.all}
      </button>
      {body}
    </div>
  )
}
