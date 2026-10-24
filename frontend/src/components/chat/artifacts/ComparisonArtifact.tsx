/**
 * Phase 292-02 (D-05 · D-17 · I-3 · sketch 3A · UI-SPEC §ComparisonArtifact) — the comparison matrix.
 *
 * A real <table>: options are columns, terms are rows, with `scope` headers so a screen reader
 * announces the option and the term for each cell. Every option cell holds EXACTLY ONE verdict
 * glyph badge — lucide Check / X / Minus, or a text `?` on a dashed amber badge — plus the verdict
 * word for screen readers; shape and border style carry the verdict, colour only supports it. A `q`
 * cell always reads italic `Not stated`, whatever text the model put on it; no cell is ever blank.
 *
 * "Only terms that differ" is local view state (it resets on reload): identical rows are dimmed at
 * rest and removed when it is pressed, with a polite count beside it. The matrix may scroll sideways
 * inside its body with a sticky term column (UI-D-292-14) — only the diagram is locked to "never".
 * One tab stop: a roving tabindex across the option cells (2-D arrows, Home / End, Ctrl+Home / End);
 * a sourced cell shows the shared `ArtifactTooltip` on hover and on focus. Model text is React text.
 */
import { useMemo, useRef, useState, type KeyboardEvent } from "react"
import { Check, Minus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { ArtifactTooltip } from "./ArtifactTooltip"
import {
  ALL_TERMS_IDENTICAL,
  COMPARISON_LEGEND_LABEL,
  COMPARISON_TERM_HEADER,
  DIFF_DISABLED_TITLE,
  DIFF_TOGGLE,
  NOT_STATED,
  hiddenTermsPhrase,
  verdictWord,
} from "./artifactCopy"
import { isResolvedSource, VERDICTS, type ArtifactBodyProps, type ComparisonCell, type Verdict } from "./artifactSpec"
import { cellDisplayText, hiddenTermCount, isIdenticalTerm, verdictGlyph } from "./comparisonModel"

const BADGE = "inline-flex size-4 shrink-0 items-center justify-center rounded-full border"

/** Badge styling per verdict — the 273 theme pairs only (UI-SPEC §Color). Keyed by the GUARD-validated verdict. */
const BADGE_TONE: Record<Verdict, string> = {
  y: "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  n: "border-rose-500/35 bg-rose-500/10 text-rose-600 dark:text-rose-400",
  m: "border-border text-muted-foreground",
  q: "border-dashed border-amber-500/40 text-amber-700 dark:text-warning",
}

function VerdictBadge({ verdict, withWord = true }: { verdict: Verdict; withWord?: boolean }) {
  const glyph = verdictGlyph(verdict)
  return (
    <span data-testid="verdict-badge" data-verdict={verdict} className={cn(BADGE, BADGE_TONE[verdict] ?? BADGE_TONE.q)}>
      {glyph === "check" && <Check className="size-2.5" strokeWidth={3} aria-hidden="true" />}
      {glyph === "cross" && <X className="size-2.5" strokeWidth={3} aria-hidden="true" />}
      {glyph === "dash" && <Minus className="size-2.5" strokeWidth={3} aria-hidden="true" />}
      {glyph === "question" && (
        <span aria-hidden="true" className="text-[10px] font-semibold leading-none">
          ?
        </span>
      )}
      {withWord && (
        <span data-testid="verdict-word" className="sr-only">
          {verdictWord(verdict)}
        </span>
      )}
    </span>
  )
}

function CellText({ cell, dim }: { cell: ComparisonCell; dim: boolean }) {
  if (cell.verdict === "q") {
    return (
      <span data-testid="cell-text" className="italic text-muted-foreground">
        {NOT_STATED}
      </span>
    )
  }
  if (!cell.text) {
    return (
      <span data-testid="cell-text" className="text-muted-foreground">
        {cellDisplayText(cell)}
      </span>
    )
  }
  return (
    <span data-testid="cell-text" className={cn("whitespace-normal break-words", dim ? "text-muted-foreground" : "text-foreground")}>
      {cell.text}
    </span>
  )
}

interface Pos {
  row: number
  col: number
}

export function ComparisonArtifact({ record }: ArtifactBodyProps) {
  const spec = record.spec.comparison
  const [diffOnly, setDiffOnly] = useState(false)
  const [roving, setRoving] = useState<Pos | null>(null)
  const [tip, setTip] = useState<{ term: number; col: number; el: HTMLElement } | null>(null)
  const cellRefs = useRef(new Map<string, HTMLTableCellElement>())
  const tipId = `${record.id}-tip`

  const identical = useMemo(() => (spec ? spec.terms.map(isIdenticalTerm) : []), [spec])
  const hidden = useMemo(() => (spec ? hiddenTermCount(spec.terms) : 0), [spec])
  if (!spec) return null

  const options = spec.options
  // Visible terms by their SPEC index (the toggle removes the identical ones).
  const visible = spec.terms.map((_, i) => i).filter((i) => !(diffOnly && identical[i]))
  const cols = options.length

  const target: Pos =
    roving && roving.row < visible.length && roving.col < cols ? roving : { row: 0, col: 0 }

  const focusAt = (row: number, col: number) => {
    const term = visible[row]
    if (term === undefined) return
    cellRefs.current.get(`${term}:${col}`)?.focus()
  }

  const onKeyDown = (row: number, col: number) => (e: KeyboardEvent<HTMLTableCellElement>) => {
    const last = visible.length - 1
    let next: Pos | null = null
    switch (e.key) {
      case "ArrowRight":
        next = { row, col: Math.min(col + 1, cols - 1) }
        break
      case "ArrowLeft":
        next = { row, col: Math.max(col - 1, 0) }
        break
      case "ArrowDown":
        next = { row: Math.min(row + 1, last), col }
        break
      case "ArrowUp":
        next = { row: Math.max(row - 1, 0), col }
        break
      case "Home":
        next = e.ctrlKey ? { row: 0, col: 0 } : { row, col: 0 }
        break
      case "End":
        next = e.ctrlKey ? { row: last, col: cols - 1 } : { row, col: cols - 1 }
        break
      case "Escape":
        setTip(null)
        return
      default:
        return
    }
    e.preventDefault()
    focusAt(next.row, next.col)
  }

  const showTip = (term: number, col: number, el: HTMLElement) => {
    const cell = spec.terms[term]?.cells[col]
    // 292-REVIEW WR-02: a "Not stated" cell never shows a clause (the guard already drops its source).
    const source = cell && cell.verdict !== "q" ? cell.source : null
    setTip(isResolvedSource(source) ? { term, col, el } : null)
  }
  const tipSource = tip ? spec.terms[tip.term]?.cells[tip.col]?.source ?? null : null

  return (
    <div data-testid="artifact-comparison">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          type="button"
          aria-pressed={diffOnly}
          disabled={hidden === 0}
          aria-disabled={hidden === 0 ? true : undefined}
          title={hidden === 0 ? DIFF_DISABLED_TITLE : undefined}
          onClick={() => setDiffOnly((v) => !v)}
          className={cn(
            "inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs sm:h-6",
            diffOnly ? "border-primary/45 bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
            hidden === 0 && "cursor-not-allowed opacity-50",
          )}
        >
          {DIFF_TOGGLE}
        </button>
        {diffOnly && (
          <span role="status" aria-live="polite" className="text-xs text-muted-foreground">
            {hiddenTermsPhrase(hidden)}
          </span>
        )}
        <div
          data-testid="comparison-legend"
          role="group"
          aria-label={COMPARISON_LEGEND_LABEL}
          className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"
        >
          {VERDICTS.map((v) => (
            <span key={v} className="inline-flex items-center gap-1">
              <VerdictBadge verdict={v} withWord={false} />
              {verdictWord(v)}
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto [scrollbar-width:thin]">
        <table className="w-full border-collapse text-xs leading-[1.4]">
          <thead>
            <tr className="h-8 bg-popover">
              <th
                scope="col"
                className="sticky left-0 z-[1] w-[24%] min-w-24 bg-popover px-3 text-left font-normal text-muted-foreground"
              >
                {COMPARISON_TERM_HEADER}
              </th>
              {options.map((o, i) => (
                <th
                  key={i}
                  scope="col"
                  className="min-w-[104px] px-3 text-left font-headline font-semibold text-foreground"
                >
                  {o}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={cols + 1} className="px-3 py-3 italic text-muted-foreground">
                  {ALL_TERMS_IDENTICAL}
                </td>
              </tr>
            ) : (
              visible.map((ti, row) => {
                const t = spec.terms[ti]
                const same = identical[ti]
                return (
                  <tr key={ti} data-identical={same ? "true" : undefined}>
                    <th
                      scope="row"
                      className="sticky left-0 z-[1] whitespace-normal break-words border-b border-border/55 bg-card px-3 py-2 text-left align-top font-normal text-muted-foreground"
                    >
                      {t.name}
                    </th>
                    {t.cells.map((cell, col) => {
                      const showing = tip !== null && tip.term === ti && tip.col === col
                      return (
                        <td
                          key={col}
                          ref={(el) => {
                            if (el) cellRefs.current.set(`${ti}:${col}`, el)
                            else cellRefs.current.delete(`${ti}:${col}`)
                          }}
                          data-testid="comparison-cell"
                          tabIndex={row === target.row && col === target.col ? 0 : -1}
                          aria-describedby={showing ? tipId : undefined}
                          onPointerEnter={(e) => showTip(ti, col, e.currentTarget)}
                          onPointerLeave={() => setTip(null)}
                          onFocus={(e) => {
                            setRoving({ row, col })
                            showTip(ti, col, e.currentTarget)
                          }}
                          onBlur={() => setTip(null)}
                          onKeyDown={onKeyDown(row, col)}
                          className="border-b border-border/55 px-3 py-2 align-top hover:bg-muted/50"
                        >
                          <div className="flex items-start gap-2">
                            <VerdictBadge verdict={cell.verdict} />
                            <CellText cell={cell} dim={same} />
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {tip && isResolvedSource(tipSource) && (
        <ArtifactTooltip id={tipId} anchor={tip.el} source={tipSource} onDismiss={() => setTip(null)} />
      )}
    </div>
  )
}
