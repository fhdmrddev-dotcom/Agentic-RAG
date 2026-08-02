/**
 * Phase 187-14 (VOCAB-03 / Req 6 · sketch 151-C, D-187-14) — StarterTemplatePicker.
 *
 * ONE QUIET DOOR TO THE THREE CURATED STARTERS, AND STILL ONE FORWARD PATH.
 *
 * ── The whole design decision, in one sentence ──
 * Choosing a template FILLS THE DESCRIBE BOX and leaves you exactly where you were, with
 * the text still editable and nothing generated. It never forks a definition onto the
 * canvas. Sketch 151 measured the axis that decides this and it is **path count, not
 * clutter**: a direct template→canvas fork would be a second way a workflow comes into
 * existence, with its own code and its own failure modes, bypassing the describe → draft
 * flow everything else is built around. C collapses it back to one. The honest cost is
 * recorded rather than waved away — re-deriving from a sentence may come back different
 * from the curated definition a human shaped, which is precisely why the DIRECT curated
 * fork keeps its home on the Workflows page (the three-homes contract, finding #19).
 * Nothing here is that fork; this module names no create, fork, publish or navigate seam,
 * and `StarterTemplatePicker.test.tsx` proves it twice — a `?raw` source fence and a
 * `toHaveBeenCalledTimes(0)` over the mocked create/publish symbols.
 *
 * ── It writes exactly one thing: `onChoose(seedSentence)` ──
 * It holds no store reference, sets no draft state and mounts no router — and it does not
 * NAME any of them either, in code or in prose, because the source fence that proves the
 * single forward path is a flat grep and a comment is exactly where "we could fork here
 * later" gets written down (the 187-13 lesson). The caller owns where that sentence
 * lands. D-187-14 (G-5 on `WorkflowBuilderPage.tsx`, 1810 L) is honoured BY CONSTRUCTION:
 * the trigger, the panel, the open state, the dismissal and the fetch all live in THIS
 * file, so the page gains ONE mount line and nothing else.
 *
 * ── It authors no sentence of its own ──
 * Every user-visible string is an identifier imported from `definitionOps` — the
 * `STRANDING_REASON` / `GovernanceSection` / `SeedReceipt` idiom, for the same reason: a
 * sentence that lives inside a component is a sentence nobody can test for drift.
 *
 * ── It DOES fetch, and that is the one leaf rule it breaks — so it is fenced ──
 * `GovernanceSection` and `StepTypePicker` name no route at all. This one must, because
 * the starters are server data. The fence is therefore narrowed rather than dropped:
 * `@/lib/api` contributes EXACTLY ONE symbol, `listStarterWorkflows` — a shipped,
 * un-gated RUN CARVE-OUT (`api/workflows.py:223`) over rows that are already
 * world-readable (`is_system_global`, mig-056). The picker widens no scope and adds no
 * visibility gate of its own; the flag gate for the describe screen belongs to the mount
 * (187-05: `describeScreen` renders on BOTH `visual_workflow_canvas` branches).
 *
 * ── A starter is identified by its phase SPINE, never one phase-type glyph ──
 * icon-convention §4, finding #36 — this was a real correction during sketch review:
 * `icon3d('llm_agent')` means "this STEP is an agent step", not "this WORKFLOW is about
 * risk". There is NO category-icon vocabulary and this file invents none. The spine is
 * rendered by the shipped `PhaseSpine`, so the glyph map is not merely un-redeclared here
 * — it is not read here at all.
 *
 * ⚠ MEASURED, AND DELIBERATELY NOT "FIXED": all three curated starters have the SAME
 * spine (`llm_agent` → `llm_emit`, 187-RESEARCH §"The template door" — each 2 phases,
 * none carrying a phase `name`). So the spine is ORIENTATION, not identification: it
 * tells you what shape of thing you are about to describe. The NAME and the SENTENCE
 * identify the row. Do not "fix" the duplicate spines by inventing a per-workflow mark.
 */
import { useCallback, useEffect, useRef, useState } from "react"

import {
  starterSeedSentence,
  STARTER_DOOR_EMPTY,
  STARTER_DOOR_HEADING,
  STARTER_DOOR_LINE,
  STARTER_DOOR_LOADING,
  STARTER_DOOR_NOTE,
  STARTER_DOOR_UNAVAILABLE,
  type StarterChoiceJSON,
} from "@/components/workflows/definitionOps"
import { PhaseSpine } from "@/components/workflows/PhaseSpine"
import type { DefShape } from "@/components/workflows/soulData"
import { listStarterWorkflows } from "@/lib/api"
import { useTechnicalNamesOptional } from "@/providers/TechnicalNamesProvider"

/**
 * One starter row as the server hands it over.
 *
 * Spelled STRUCTURALLY on top of `definitionOps.StarterChoiceJSON` rather than importing
 * `PublishedWorkflow`, so the API client contributes exactly one symbol to this module
 * and the source fence can say so as a flat count. `StarterChoiceJSON` already accepts a
 * raw `listStarterWorkflows` row with no adapter — pinned at COMPILE time by a type-only
 * `PublishedWorkflow` assignment in `definitionOps.test.ts` (plan 187-10), so drift breaks
 * there rather than here.
 */
interface StarterRow extends StarterChoiceJSON {
  id: string
  slug: string
}

/** What the panel currently knows. Four states, because a fetch has four outcomes and
 *  collapsing "we could not look" into "there are none" would make the surface report a
 *  fact it does not have. */
type PanelState =
  | { kind: "loading" }
  | { kind: "ready"; rows: readonly StarterRow[] }
  | { kind: "failed" }

export interface StarterTemplatePickerProps {
  /**
   * The user picked a starter. The argument is `starterSeedSentence(starter)` — the
   * workflow's own plain-language `business_requirement`, falling back to its name.
   *
   * THIS IS THE ONLY THING THIS COMPONENT WRITES. The caller puts it in the describe box;
   * nothing is created, forked, saved or navigated to.
   */
  onChoose: (seedSentence: string) => void
  /** Placement only. The component owns its own layout inside this box. */
  className?: string
}

export function StarterTemplatePicker({ onChoose, className }: StarterTemplatePickerProps) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<PanelState>({ kind: "loading" })

  // The root wraps BOTH the trigger and the panel — see the dismissal comment below for
  // why that containment boundary (rather than the panel alone) is load-bearing.
  const rootRef = useRef<HTMLDivElement | null>(null)

  // FETCH ON OPEN, NOT ON MOUNT. The door sits on the Builder's first screen, which most
  // sessions never ask a question of; a mount-time request would spend a round trip on
  // every visit to buy nothing. `requested` makes the successful fetch happen once no
  // matter how often the panel is toggled.
  const requested = useRef(false)
  const abortRef = useRef<AbortController | null>(null)

  // Abort in flight on unmount. The panel can be dismissed (or the whole screen replaced
  // by the draft) long before the response lands, and a `setState` after that is a leak
  // dressed as a warning.
  useEffect(
    () => () => {
      abortRef.current?.abort()
      abortRef.current = null
    },
    [],
  )

  const load = useCallback(() => {
    if (requested.current) return
    requested.current = true

    const controller = new AbortController()
    abortRef.current = controller
    setState({ kind: "loading" })

    listStarterWorkflows(controller.signal)
      .then((rows) => {
        if (controller.signal.aborted) return
        setState({ kind: "ready", rows })
      })
      .catch(() => {
        if (controller.signal.aborted) return
        // NOTHING is invented on failure: no cached list, no remembered rows, no
        // fabricated starter. The panel says so plainly and offers zero rows.
        setState({ kind: "failed" })
        // A failure is allowed one more try on the next open — the request is idempotent
        // and read-only, and a door that stays broken for the rest of the session because
        // of one blip is worse than a second GET. A SUCCESS is never re-fetched.
        requested.current = false
      })
  }, [])

  const toggle = useCallback(() => {
    setOpen((wasOpen) => {
      if (!wasOpen) load()
      return !wasOpen
    })
  }, [load])

  const dismiss = useCallback(() => setOpen(false), [])

  // Escape closes, from anywhere. GATED on `open` (the `StepTypePicker.tsx:100-107`
  // precedent): no listener exists while the panel is closed, so it costs nothing at rest
  // and cannot accumulate across renders.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, dismiss])

  // A press outside closes it. `mousedown` rather than `click`, so a press that starts
  // outside dismisses before any stray activation inside can land.
  //
  // ⚠ THE EVENT PHASE IS A DECISION, NOT AN INHERITANCE — CAPTURE, for a DIFFERENT reason
  // than `StepTypePicker`'s. There, capture is REQUIRED: the canvas plane is driven by
  // d3-zoom, which `stopPropagation()`s on mousedown, and a pane press was measured
  // reaching window 0 times bubbling and 1 time capturing. This picker lives on the
  // DESCRIBE screen, where no d3-zoom plane exists, so bubbling would work TODAY. Capture
  // is chosen anyway because it is the only phase immune to any future handler between
  // the target and `window` swallowing the event — and the failure mode that bug produced
  // is the worst one a menu has: it became inescapable except by picking something, which
  // turns "let me see my options" into a forced choice.
  //
  // Capture's only cost is firing BEFORE the target's own React handlers, which would make
  // a press on the trigger dismiss-then-reopen. The containment check below is therefore
  // against the ROOT (trigger + panel), not the panel alone: a press on the trigger is
  // contained, so this handler ignores it and the trigger's own click toggles cleanly.
  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      const root = rootRef.current
      if (root && event.target instanceof Node && !root.contains(event.target)) dismiss()
    }
    window.addEventListener("mousedown", onPointer, true)
    return () => window.removeEventListener("mousedown", onPointer, true)
  }, [open, dismiss])

  const choose = useCallback(
    (starter: StarterRow) => {
      // The whole of the interaction: a sentence, and the panel closes. No definition is
      // constructed, no request is made, nothing is navigated to.
      onChoose(starterSeedSentence(starter))
      setOpen(false)
    },
    [onChoose],
  )

  return (
    <div ref={rootRef} className={["relative", className ?? ""].join(" ").trim()}>
      <button
        type="button"
        data-testid="starter-door-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
        className={[
          "border-0 bg-transparent p-0 text-left text-[11.5px] leading-snug",
          "text-muted-foreground underline-offset-2 hover:text-foreground hover:underline",
          "focus-visible:text-foreground focus-visible:underline focus-visible:outline-none",
        ].join(" ")}
      >
        {STARTER_DOOR_LINE}
      </button>

      <StarterPanel open={open} state={state} onChoose={choose} />
    </div>
  )
}

interface StarterPanelProps {
  open: boolean
  state: PanelState
  onChoose: (starter: StarterRow) => void
}

/**
 * The panel itself, split out so `open === false` renders NOTHING AT ALL — no hidden DOM,
 * no stale focus trap (the `StepTypePicker` / `SeedReceipt` contract). The trigger above
 * must survive the closed state, which is the only reason this is a second component.
 */
function StarterPanel({ open, state, onChoose }: StarterPanelProps) {
  // The app-wide reveal, READ (never owned) here — the shipped fail-closed accessor.
  // Null outside a provider means plain language, no control, no crash.
  const technicalNames = useTechnicalNamesOptional()
  const showTechnical = technicalNames?.showTechnical ?? false

  if (!open) return null

  const rows = state.kind === "ready" ? state.rows : []
  const status =
    state.kind === "loading"
      ? STARTER_DOOR_LOADING
      : state.kind === "failed"
        ? STARTER_DOOR_UNAVAILABLE
        : rows.length === 0
          ? STARTER_DOOR_EMPTY
          : null

  return (
    <div
      data-testid="starter-door-panel"
      role="menu"
      aria-label={STARTER_DOOR_HEADING}
      className={[
        "absolute bottom-full left-0 z-20 mb-2 w-[340px] rounded-[14px] border border-border",
        "bg-card p-[7px] shadow-lg",
        // ONE entrance, and it keys off `open` alone — no row animates on selection, and
        // nothing is staged. The rows arrive together because the list arrives together.
        "animate-in fade-in-0 slide-in-from-bottom-1 duration-100 motion-reduce:animate-none",
      ].join(" ")}
    >
      <div className="px-2 pt-[5px] font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
        {STARTER_DOOR_HEADING}
      </div>
      <p
        data-testid="starter-door-note"
        className="px-2 pb-[7px] pt-1 text-[10.5px] leading-snug text-muted-foreground"
      >
        {STARTER_DOOR_NOTE}
      </p>

      {status !== null && (
        <p
          data-testid="starter-door-status"
          role="status"
          className="px-2 pb-[7px] pt-1 text-[11.5px] leading-snug text-muted-foreground"
        >
          {status}
        </p>
      )}

      {rows.map((starter) => {
        // The shipped Workflows-page read: `PublishedWorkflow.definition` is the loose
        // `Record<string, unknown>` JSONB and every soul surface narrows it exactly this
        // way (`WorkflowsPage.tsx:761`, `:1015`). `PhaseSpine` is total over a malformed
        // or absent definition, so a bad row renders quietly rather than crashing the door.
        const def = starter.definition as DefShape | undefined
        const sentence = starterSeedSentence(starter)

        return (
          <button
            key={starter.id || starter.slug}
            type="button"
            role="menuitem"
            data-testid={`starter-door-row-${starter.slug}`}
            data-slug={starter.slug}
            onClick={() => onChoose(starter)}
            className={[
              "flex w-full flex-col items-start gap-[5px] rounded-[9px] border-0 bg-transparent",
              "cursor-pointer px-2 py-[7px] text-left text-[12.5px] text-foreground",
              "hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
            ].join(" ")}
          >
            {/* Orientation, not identification — the shipped spine, so no glyph map is
                read (let alone declared) here. All three starters share this shape. */}
            <span data-testid={`starter-door-spine-${starter.slug}`} aria-hidden="true">
              <PhaseSpine def={def} scale="card" />
            </span>

            <span className="min-w-0">
              <span data-testid={`starter-door-name-${starter.slug}`} className="block">
                {starter.name}
              </span>
              <small
                data-testid={`starter-door-sentence-${starter.slug}`}
                className="block text-[10.5px] leading-snug text-muted-foreground"
              >
                {sentence}
              </small>
              {showTechnical && (
                <span
                  data-testid={`starter-door-technical-${starter.slug}`}
                  className="mt-0.5 block font-mono text-[10px] text-muted-foreground"
                >
                  {starter.slug}
                </span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default StarterTemplatePicker
