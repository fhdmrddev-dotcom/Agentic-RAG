/**
 * Phase 184-07 Task 2 (D-184-11 · R10b · sketch 139 variant C, folded into A) —
 * StepTypePicker.
 *
 * THE `＋` MENU. Six step types, in plain language, at the point where the new step
 * will land.
 *
 * ── It speaks the D-183-06 plain-language vocabulary, with the 3D mark ──
 * Each row is `PHASE_TYPE_SENTENCES[type]` ("Search the knowledge base", "Wait for
 * you", …) beside the shared `renderPhaseMark(type)` element. **Never a text glyph** —
 * that single miss is most of why an earlier sketch batch read as *"very basic … does
 * not look very agentic"*, and the 3D mark is a locked rule of the sketch language, not
 * a preference. The technical `phase_type` identifier appears only behind the ⌥
 * Technical-names reveal.
 *
 * ── The refusal: offered DISABLED, WITH its reason, never hidden (R10b) ──
 * Sketch 139 variant C's finding, folded into winner A as a build rule: an option that
 * vanishes teaches nothing, and an option greyed out mutely is worse — the author is
 * left to guess what they did wrong. So every row the definition's shape declines is
 * still rendered, disabled, with its sentence visible in the DOM beside it (not in a
 * `title`, not in a tooltip) and wired to the row through `aria-describedby`.
 *
 * ── This component AUTHORS NO REASON OF ITS OWN, and consults no server ──
 * Every row and every `disabledReason` comes from `definitionOps.allowedTypesAt`, the
 * pure shape predicate. The distinction is load-bearing and R10 states it: **a refusal
 * is a SHAPE rule, decided locally from the phases already in hand; a verdict is a
 * SERVER judgement.** Keeping the two visibly apart is what keeps D-182-06 intact — the
 * client never grows a second opinion about validity. This module therefore imports
 * nothing from the API client, names no server route, and opens no request; a `?raw`
 * fence and a whole-suite request spy in `StepTypePicker.test.tsx` both prove it, each
 * with a positive control.
 *
 * ── D-184-11 — there is no slug field here, deliberately ──
 * Choosing a type calls `onChoose(type)` and nothing else. The CALLER derives the slug
 * with `definitionOps.slugForType` and builds the phase with `minimalPhaseFor`, because
 * the slug is **node identity** on the canvas (`node.id === phase.slug`) and a
 * `skip_to_phase` target inside `on_failure`. Letting an author rename it would need a
 * cascade across both — a feature nobody asked for, and the failure mode is a silently
 * broken fallback branch. The plain-language TITLE is what the user names, in the
 * inspector, and it is free of all of that.
 *
 * ── The colour budget (sketch 137, load-bearing) ──
 * Type colour is a TINT BEHIND THE MARK only, read from the same `ICON_TINT` table the
 * canvas node face uses — one copy, so a picker row and the card it creates can never
 * disagree. Strong colour belongs to Phase 188's run status. The panel's entrance
 * animation keys off `open` and nothing else; no row animates on selection.
 *
 * A LEAF, not a wired surface: it takes `phases` and an insertion `index`, renders, and
 * calls back. It creates no phase, holds no store reference and owns no placement, so
 * it renders in a plain unit test with no provider and no `ReactFlowProvider`.
 */
import { useCallback, useEffect, useId, useRef } from "react"

import {
  allowedTypesAt,
  type PhaseTypeId,
} from "@/components/workflows/definitionOps"
import { DEFAULT_TINT, ICON_TINT, renderPhaseMark } from "@/components/workflows/nodePresentation"
import {
  PHASE_TYPE_SENTENCES,
  PHASE_TYPE_SUBTITLES,
  type PhaseSpecJSON,
} from "@/components/workflows/phaseVocabulary"
import { useTechnicalNamesOptional } from "@/providers/TechnicalNamesProvider"

export interface StepTypePickerProps {
  /** The definition's phases as they stand. Read-only — the picker mutates nothing. */
  phases: readonly PhaseSpecJSON[]
  /** The RENDER position the new step would take (`insertPhaseAt`'s index). */
  index: number
  /** The user picked a type. The caller derives the slug and builds the phase. */
  onChoose: (type: PhaseTypeId) => void
  /** Escape, or a click outside. REQUIRED — a menu with no way out is not a menu. */
  onDismiss: () => void
  /** Closed renders nothing at all: no hidden DOM, no stale focus trap. */
  open: boolean
}

export function StepTypePicker({
  phases,
  index,
  onChoose,
  onDismiss,
  open,
}: StepTypePickerProps) {
  const baseId = useId()
  const panelRef = useRef<HTMLDivElement | null>(null)

  // The app-wide reveal, READ (never owned) here — the shipped fail-closed accessor
  // (`WorkflowCanvas.tsx:181-183`). Null outside a provider means plain language, no
  // control, no crash.
  const technicalNames = useTechnicalNamesOptional()
  const showTechnical = technicalNames?.showTechnical ?? false

  const dismiss = useCallback(() => onDismiss(), [onDismiss])

  // Escape closes, from anywhere. GATED on `open` (the `WorkflowBuilderPage.tsx:217-231`
  // precedent): no listener exists while the picker is closed, so it costs nothing at
  // rest and cannot accumulate across renders.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, dismiss])

  // A press outside the panel closes it. `mousedown` rather than `click`, so a press
  // that starts outside dismisses before any stray activation inside can land.
  //
  // ⚠ CAPTURE PHASE, and it is not defensive style — it is the only phase that works
  // here. The canvas plane is driven by d3-zoom, which calls `stopPropagation()` on
  // mousedown to own its pan gesture, so a bubble-phase listener on `window` NEVER sees
  // a press on the plane. Measured live: pressing `.react-flow__pane` reached window 0
  // times bubbling and 1 time capturing. The menu was therefore inescapable by clicking
  // away — the operator found it could only be closed by picking something, which turns
  // "let me see my options" into a forced choice.
  //
  // Capture fires before the target's own handlers, and the containment check below is
  // what keeps a press INSIDE the panel from dismissing it, so ordering costs nothing.
  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      const panel = panelRef.current
      if (panel && event.target instanceof Node && !panel.contains(event.target)) dismiss()
    }
    window.addEventListener("mousedown", onPointer, true)
    return () => window.removeEventListener("mousedown", onPointer, true)
  }, [open, dismiss])

  if (!open) return null

  const choices = allowedTypesAt(phases, index)
  const atEnd = index >= phases.length

  return (
    <div
      ref={panelRef}
      data-testid="step-type-picker"
      role="menu"
      aria-label="Add a step"
      className={[
        "w-[300px] rounded-[14px] border border-border bg-card p-[7px] shadow-lg",
        "animate-in fade-in-0 slide-in-from-bottom-1 duration-100 motion-reduce:animate-none",
      ].join(" ")}
    >
      <div className="px-2 pb-[7px] pt-[5px] font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
        {atEnd ? "Add a step at the end" : `Add a step before step ${index + 1}`}
      </div>

      {choices.map((choice) => {
        const reason = choice.disabledReason
        const refused = typeof reason === "string" && reason.length > 0
        const reasonId = `${baseId}-why-${choice.type}`
        const sentence = PHASE_TYPE_SENTENCES[choice.type] ?? choice.type
        const subtitle = PHASE_TYPE_SUBTITLES[choice.type] ?? ""

        return (
          <button
            key={choice.type}
            type="button"
            role="menuitem"
            data-testid={`step-type-choice-${choice.type}`}
            data-phase-type={choice.type}
            data-refused={refused ? "true" : "false"}
            disabled={refused}
            aria-disabled={refused ? "true" : undefined}
            // The reason is REAL DOM text below, not a title attribute — assistive
            // technology reads the same sentence a sighted author reads.
            aria-describedby={refused ? reasonId : undefined}
            onClick={() => {
              if (refused) return
              onChoose(choice.type)
            }}
            className={[
              "flex w-full items-center gap-[10px] rounded-[9px] border-0 bg-transparent px-2 py-[7px]",
              "text-left text-[12.5px] text-foreground",
              refused
                ? "cursor-not-allowed opacity-[0.42]"
                : "cursor-pointer hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
            ].join(" ")}
          >
            {/* The 3D mark, with the type tint BEHIND it — the whole colour budget
                for this row (sketch 137-D). Decorative: the sentence carries meaning. */}
            <span
              aria-hidden="true"
              data-testid={`step-type-mark-${choice.type}`}
              className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px]"
              style={{ background: ICON_TINT[choice.type] ?? DEFAULT_TINT }}
            >
              {renderPhaseMark(choice.type)}
            </span>

            <span className="min-w-0">
              <span className="block">{sentence}</span>
              <small
                id={refused ? reasonId : undefined}
                data-testid={refused ? `step-type-reason-${choice.type}` : undefined}
                className={[
                  "block text-[10.5px] leading-snug",
                  refused ? "text-[hsl(38_92%_66%)]" : "text-muted-foreground",
                ].join(" ")}
              >
                {refused ? reason : subtitle}
              </small>
              {showTechnical && (
                <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
                  {choice.type}
                </span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
