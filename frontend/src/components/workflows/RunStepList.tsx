/**
 * Phase 200.2 (RUN-05 / SC2 / SC3 / D-05 / D-06 / D-07 / D-11 / D-12 / A-01 / A-02 / A-03 / A-08 / R-2 / R-3)
 *
 * THE RUN PROCESS TRACE — Option C: The strict single-line step list.
 *
 * Each step renders ONE line: status mark · step name · the step's own stored yield.
 * The yield acts as the disclosure control: clicking a step lazily fetches real citation
 * passages on demand (D-12). If citations exist, the step expands to render them through
 * CitationCard; if empty, it degrades to a plain-text yield with no chevron.
 *
 * ── INVARIANTS ──────────────────────────────────────────────────────────────────────────
 *  1. ZERO GLYPH IMPORTS. Status marks come from the inherited glyph vocabulary.
 *  2. ZERO SPELLED STRINGS. All user-visible copy is imported from runColumnVocabulary or receiptVocabulary.
 *  3. ZERO RAW HTML. Passage text and model-influenced text are rendered strictly as React children.
 *  4. NO RUN-LEVEL AGGREGATE COUNTS.
 *  5. NO SCORE/RELEVANCE DISPLAY in citation passages.
 */
import { useId, useState } from "react"
import type { WorkflowRunPhase, RunStepCitation } from "@/lib/api"
import { getWorkflowRunPhaseCitations } from "@/lib/api"
import { CitationCard } from "@/components/chat/CitationCard"
import { own } from "@/components/workflows/ownProperty"
// ── Phase 214-11 Task 2b (STEP-04 / D-214-16) — the ONE step-identity element, `size="row"`.
// It takes props; this component resolves nothing and reaches for no map.
import { StepIdentity, type StepIdentityProps } from "@/components/workflows/StepIdentity"
import { phaseRunFacts } from "@/components/workflows/phaseDuration"
import { OUTCOME_FINISHED, countDeclared } from "@/components/workflows/receiptVocabulary"
import {
  CITATIONS_COLLAPSE_LABEL,
  CITATIONS_EXPAND_LABEL,
  EMPTY_TRACE_NO_STEPS,
  PROCESS_TRACE_LANDMARK,
  YIELD_WROTE_AN_ANSWER,
} from "@/components/workflows/runColumnVocabulary"

interface Face {
  glyph: string
  tone: string
  ring: string
  dim?: boolean
}

const READING_FACE: Record<string, Face> = {
  done: {
    glyph: "✓",
    tone: "text-[hsl(var(--success))]",
    ring: "border-[hsl(var(--success)/0.45)] bg-[hsl(var(--success)/0.10)]",
  },
  failed: {
    glyph: "✕",
    tone: "text-[hsl(0_80%_80%)]",
    ring: "border-[hsl(0_80%_80%/0.45)] bg-[hsl(0_80%_80%/0.10)]",
  },
  running: {
    glyph: "●",
    tone: "text-accent-violet-text",
    ring: "border-accent-violet bg-accent-violet/15",
  },
  "waiting-for-you": {
    glyph: "!",
    tone: "text-accent-violet-text",
    ring: "border-accent-violet bg-accent-violet/15",
  },
  "not-started": {
    glyph: "○",
    tone: "text-muted-foreground/60",
    ring: "border-border/40 bg-transparent",
    dim: true,
  },
  skipped: {
    glyph: "⤳",
    tone: "text-muted-foreground",
    ring: "border-border/40 bg-transparent",
    dim: true,
  },
  "recorded-not-sent": {
    glyph: "↛",
    tone: "text-muted-foreground",
    ring: "border-border/40 bg-transparent",
  },
  cancelled: {
    glyph: "⏹",
    tone: "text-muted-foreground",
    ring: "border-border/40 bg-transparent",
  },
  unknown: {
    glyph: "?",
    tone: "text-muted-foreground",
    ring: "border-border/40 bg-transparent",
  },
}

const FALLBACK_FACE: Face = {
  glyph: "?",
  tone: "text-muted-foreground",
  ring: "border-border/40 bg-transparent",
  dim: false,
}

function resolveFace(reading: string | undefined): Face {
  if (!reading) return FALLBACK_FACE
  const hit = own(READING_FACE, reading)
  return hit ?? FALLBACK_FACE
}

export interface RunStepListProps {
  phases: readonly WorkflowRunPhase[]
  titleOf: (slug: string) => string
  /**
   * Phase 214-11 Task 2b (STEP-04 / D-214-16 / D-214-14) — the step's ACTION and its SERVICE,
   * resolved by `WorkflowRunPage` in the same shape as `titleOf`, and `null` when there is no
   * honest answer.
   *
   * ⚠ ALL THREE OPTIONAL: an existing caller renders exactly the list it rendered before.
   * ⚠ THIS COMPONENT RESOLVES NOTHING — no connection list, no store, no fetch (asserted
   * mechanically). A `null` service is a legitimate reading and renders the action alone.
   */
  actionOf?: (slug: string) => string | null
  serviceOf?: (slug: string) => string | null
  shapeOf?: (slug: string) => StepIdentityProps["shape"]
  runId: string
  runStatus?: string | null
  liveOf?: (slug: string) => { reading: string; label: string } | undefined
  now?: number
}

export function RunStepList({
  phases,
  titleOf,
  actionOf,
  serviceOf,
  shapeOf,
  runId,
  runStatus,
  liveOf,
  now,
}: RunStepListProps) {
  const [citationsState, setCitationsState] = useState<Record<string, RunStepCitation[] | null>>({})
  const [expandedSlugs, setExpandedSlugs] = useState<Record<string, boolean>>({})
  const baseId = useId()

  if (phases.length === 0) {
    return (
      <section
        data-testid="run-transcript"
        aria-label={PROCESS_TRACE_LANDMARK}
        className="rounded-xl border border-border/40 bg-card/40 p-4 text-sm text-muted-foreground text-center"
      >
        {EMPTY_TRACE_NO_STEPS}
      </section>
    )
  }

  const handleToggle = async (slug: string) => {
    const isCurrentlyExpanded = Boolean(expandedSlugs[slug])
    if (isCurrentlyExpanded) {
      setExpandedSlugs((prev) => ({ ...prev, [slug]: false }))
      return
    }

    // If citations have not been loaded yet, fetch them
    if (citationsState[slug] === undefined) {
      try {
        const citations = await getWorkflowRunPhaseCitations(runId, slug)
        setCitationsState((prev) => ({ ...prev, [slug]: citations }))
        if (citations && citations.length > 0) {
          setExpandedSlugs((prev) => ({ ...prev, [slug]: true }))
        }
      } catch {
        // Degrade on error
        setCitationsState((prev) => ({ ...prev, [slug]: [] }))
      }
    } else if (citationsState[slug] && citationsState[slug]!.length > 0) {
      setExpandedSlugs((prev) => ({ ...prev, [slug]: true }))
    }
  }

  return (
    <section data-testid="run-transcript" aria-label={PROCESS_TRACE_LANDMARK} className="flex flex-col gap-2">
      {phases.map((phase, idx) => {
        const slug = phase.slug
        const stepTitle = titleOf(slug)
        // ── Phase 214-11 Task 2b (D-214-16 · sketch 216 §3 surface 4) — the step's identity,
        // computed ONCE per row and rendered in BOTH arms below. The two arms (expandable vs
        // plain) already duplicate their name slot; deriving this twice would be a third copy
        // and the place the two arms would eventually disagree.
        // ⚠ THE ACTION IS THE GATE — `serviceOf` may honestly answer `null`, and keying on the
        // service would suppress exactly the case the element exists to render.
        const rowAction = actionOf?.(slug) ?? null
        const identity = rowAction
          ? { action: rowAction, service: serviceOf?.(slug) ?? null, shape: shapeOf?.(slug) ?? {} }
          : null
        // The row's NAME, as one node. When the step has an identity, the identity IS the name
        // — the sheet draws one name slot per row, and printing the authored title beside the
        // action would state the same step twice on one line.
        const titleNode = identity ? (
          <StepIdentity
            shape={identity.shape}
            action={identity.action}
            service={identity.service}
            size="row"
          />
        ) : (
          stepTitle
        )
        const liveInfo = liveOf ? liveOf(slug) : undefined
        const facts = phaseRunFacts(phase, runStatus, now)
        const isRunTerminal = runStatus !== "active" && runStatus !== "pending"
        const liveReading = liveInfo?.reading ?? (phase.status === "completed" ? "done" : phase.status === "active" && isRunTerminal ? "did-not-finish" : phase.status)
        const face = resolveFace(liveReading)

        const countInfo = facts.count
        const countChip = countInfo ? countDeclared(countInfo.count, countInfo.noun) : null
        const isFinished = facts.outcome === OUTCOME_FINISHED
        const hasText = Boolean(phase.deliverable_text && phase.deliverable_text.trim().length > 0)
        const wroteAnswer = isFinished && !countChip && hasText

        let yieldText: string | null = null
        if (countChip) {
          yieldText = countChip
        } else if (wroteAnswer) {
          yieldText = YIELD_WROTE_AN_ANSWER
        } else if (!isRunTerminal && liveInfo?.label) {
          yieldText = liveInfo.label
        } else if (!isFinished) {
          yieldText = facts.outcome
        } else {
          yieldText = null
        }

        const hasSourceConflict = liveInfo?.reading === "running" && phase.status === "completed"
        const citations = citationsState[slug]
        const hasCitations = citations !== undefined && citations !== null && citations.length > 0
        const isExpanded = Boolean(expandedSlugs[slug]) && hasCitations
        const panelId = `${baseId}-phase-${idx}-citations`

        return (
          <div
            key={slug}
            data-testid={`step-card-${slug}`}
            data-reading={liveReading}
            data-outcome={facts.outcome}
            data-source-conflict={hasSourceConflict ? "true" : undefined}
            className="flex flex-col rounded-xl border border-border/40 bg-card/60 transition-colors"
          >
            {hasCitations ? (
              <button
                type="button"
                onClick={() => handleToggle(slug)}
                aria-expanded={isExpanded}
                aria-controls={panelId}
                aria-label={isExpanded ? CITATIONS_COLLAPSE_LABEL : CITATIONS_EXPAND_LABEL}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-xl"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span
                    aria-hidden="true"
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${face.ring} ${face.tone}`}
                  >
                    {face.glyph}
                  </span>
                  <span data-testid="step-title" className="truncate text-sm font-medium text-foreground">{titleNode}</span>
                  {yieldText && (
                    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground/80 font-normal">
                      <span aria-hidden="true" className="text-muted-foreground/50 select-none">·</span>
                      <span data-testid={`step-yield-${slug}`}>
                        {countChip ? (
                          <span data-testid={`step-count-${slug}`}>{yieldText}</span>
                        ) : (
                          yieldText
                        )}
                      </span>
                    </span>
                  )}
                </div>
                <span
                  aria-hidden="true"
                  className="text-xs text-muted-foreground transition-transform select-none"
                >
                  {isExpanded ? "▾" : "▸"}
                </span>
              </button>
            ) : (
              <div
                onClick={() => handleToggle(slug)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span
                    aria-hidden="true"
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${face.ring} ${face.tone}`}
                  >
                    {face.glyph}
                  </span>
                  <span data-testid="step-title" className="truncate text-sm font-medium text-foreground">{titleNode}</span>
                  {yieldText && (
                    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground/80 font-normal">
                      <span aria-hidden="true" className="text-muted-foreground/50 select-none">·</span>
                      <span data-testid={`step-yield-${slug}`}>
                        {countChip ? (
                          <span data-testid={`step-count-${slug}`}>{yieldText}</span>
                        ) : (
                          yieldText
                        )}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            )}

            {isExpanded && citations && citations.length > 0 && (
              <div
                id={panelId}
                data-testid={`step-citations-${slug}`}
                className="flex flex-col gap-2 border-t border-border/30 px-4 py-3 bg-muted/20 rounded-b-xl"
              >
                {citations.map((cit, cIdx) => (
                  <CitationCard
                    key={`${cit.document_id}-${cit.chunk_index ?? cIdx}`}
                    citation={{
                      document_id: cit.document_id,
                      filename: cit.filename,
                      chunk_index: cit.chunk_index ?? 0,
                      passage: cit.passage ?? "",
                      similarity: null,
                      is_full_doc: false,
                    }}
                    n={cIdx + 1}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}
