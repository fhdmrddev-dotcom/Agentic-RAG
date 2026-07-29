/**
 * Phase 185-07 Task 1 (GOVERN-01 / GOVERN-03, sketch 142-B winner, D-185-15/16) —
 * GovernanceSection.
 *
 * HOW STRICTLY ONE STEP IS HELD, said in one place. The panel is where you SET;
 * the canvas is where you SEE (sketch 147, operator-locked). Both governance dials
 * live here because `PhaseNodeCard.tsx` forbids any focusable control inside a node
 * card, so a clickable canvas mark is not a representable design.
 *
 * ── THIS COMPONENT AUTHORS NO SENTENCE OF ITS OWN, AND CONSULTS NO SERVER ──
 * Every user-visible string is an identifier imported from `definitionOps` — the same
 * `STRANDING_REASON` / `StepTypePicker` idiom, and for the same reason: a refusal
 * reason that lives inside a component is a refusal reason nobody can test for drift.
 * Its suite asserts character-identity against those imported names. This module
 * imports nothing from the API client, names no route and opens no request; a `?raw`
 * fence in `GovernanceSection.test.tsx` proves it, with a positive control.
 *
 * ── THE REFUSAL IS A SHAPE RULE, DECIDED LOCALLY ──
 * The lock is derived at RENDER TIME from the tools already in hand, intersected with
 * the KB tool list the SERVER supplies (D-185-09). Never in state, never in an effect —
 * that is what makes the dial, the strike-through and the canvas seal all move on the
 * same commit as a tool chip. The client PREDICTS; the server ENFORCES: the run-time
 * gate reads the server's own detection and is unreachable from here, so a wrong client
 * read is a display bug by construction and never a safety hole.
 *
 * ── THE ONE-WAY LOCK (sketch 142, operator) — you can only undo a lock you created ──
 *  - `detected`    a KB-reading tool is switched on. NO switch exists in any variant;
 *                  removing the tool is the only exit. The loose side is struck through
 *                  and disabled, with its reason as REAL DOM TEXT wired by
 *                  `aria-describedby` — never a `title` attribute (the 184-07 lesson).
 *  - `already-set` the deliverable's `citation_policy` is strict. Read-only text here;
 *                  the shipped policy dial one scroll up owns that value, and rendering
 *                  a second control for it would let two surfaces one scroll apart make
 *                  opposite claims about the same stored field (L-14).
 *  - `escalated`   the author turned it on by hand. The ONE cause they may undo. If
 *                  detection later applies, detection wins, the stored bit goes inert
 *                  and the undo affordance disappears regardless of it (SPEC Req 3).
 *
 * ── WHICH STEPS CARRY A DIAL (D-185-15) ──
 * Only `llm_agent` and `llm_batch_agents`. They are the only configs with
 * `available_tools`, i.e. the only steps that can ever SATISFY the gate. The trap this
 * closes: an escalated `llm_single` has no retrieval path at all, so the engine gate
 * would fail it on every single run — an author-reachable, permanently-failing step.
 * Restricting the control makes that state unrepresentable rather than documented.
 * A control that could never do anything is REMOVED, not disabled (SPEC Req 5): the
 * query returns null, not a greyed node. But the SECTION still renders (D-185-16),
 * carrying the locked phrase, so a step that is held to nothing can never read as a
 * build that forgot to render its control.
 *
 * ── THE HONESTY RULE (D-185-02) ──
 * The attached-gate sentence is AGENT-STEP copy. The deliverable path's stronger
 * every-leaf claim is computable only over a structured leaf set that only `llm_emit`
 * produces, and detection only ever fires on the two agent types. The honest claim on a
 * detected agent step is retrieved-and-pointed-at, and the constant says exactly that.
 *
 * A LEAF, not a wired surface: presentational and caller-driven. It reads no context,
 * fetches nothing, holds no store reference, and its only write is one of two booleans
 * handed back to the caller (D-185-10 — these fields are siblings of `validators`, and
 * `PhaseFormPanel`'s only write seam patches `config`).
 */
import { useId } from "react"

import {
  ACTION_RISK_ARM_LABEL,
  ACTION_RISK_ARMED_NOTE,
  GROUNDING_ALREADY_SET_NOTE,
  GROUNDING_ATTACHED_GATE,
  GROUNDING_DIAL_LOOSE_LABEL,
  GROUNDING_DIAL_STRICT_LABEL,
  GROUNDING_LOCK_REFUSAL,
  GROUNDING_NOTHING_TO_PROVE,
  GROUNDING_TOOL_LIST_IS_THE_CONTROL,
  GROUNDING_WHY_DETECTED,
  GROUNDING_WHY_ESCALATED,
} from "@/components/workflows/definitionOps"

/**
 * The section heading (sketch 142-B's `.sechd`). A module-scope const rather than a
 * literal at its two use sites, because the `<h3>` text and the dial group's accessible
 * name must be the same words — a group labelled differently from the heading above it
 * is a screen-reader read of a surface that does not exist.
 */
const SECTION_HEADING = "How strictly this step is held"

/**
 * The two step types that carry a dial (D-185-15). Mirrors the backend rule exactly:
 * `available_tools` exists only on `LlmAgentPhaseConfig` and `LlmBatchAgentsPhaseConfig`,
 * so these are the only types `grounding_cause` can ever report `detected` for.
 */
const DIAL_TYPES: readonly string[] = ["llm_agent", "llm_batch_agents"]

/** The deliverable — the one type whose strictness is owned by another control. */
const EMIT_TYPE = "llm_emit"

/** The `citation_policy` value that makes the deliverable already-strict. */
const STRICT_POLICY = "strict"

/**
 * The three causes and their absence, in the SAME total order the server's
 * `grounding_cause()` uses: `detected` first, then `already-set`, then `escalated`.
 * That ordering is the mechanism behind "detection wins and the undo disappears".
 */
export type GovernanceCause = "detected" | "already-set" | "escalated" | null

/** The only write this component can make — two booleans, both author intent (D-185-07). */
export interface GovernancePatch {
  grounding_escalated?: boolean
  action_risk_armed?: boolean
}

export interface GovernanceSectionProps {
  /** The step's `phase_type`. Decides whether a dial exists at all (D-185-15). */
  phaseType: string
  /** The step's currently selected tools, already resolved by the caller. */
  availableTools: readonly string[]
  /** The server's KB tool list (D-185-09). The caller reads it off `useGroundingBundle`.
   *  EMPTY means the palette could not be read — that marks nothing, and marking nothing
   *  is the safe direction, because the run-time gate is server-side and unconditional. */
  kbTools: readonly string[]
  /** Author intent only (D-185-07). Inert whenever detection applies. */
  groundingEscalated: boolean
  /** Author intent only. Default OFF in 185 — no engine step type performs outbound
   *  egress yet; Phase 189's external-action node arrives armed-on per its SC#2. */
  actionRiskArmed: boolean
  /** D-185-10 — the PhaseSpec-level write, caller-owned. ABSENT ⇒ the section renders
   *  read-only (presses are inert) rather than disappearing, so a dropped wiring is
   *  visible on screen rather than silent. */
  onGovernanceChange?: (patch: GovernancePatch) => void
  /** `llm_emit` only: its shipped `citation_policy`, so the already-set cause can be read
   *  WITHOUT this section owning a second control for it. */
  citationPolicy?: string
}

const SECTION_CLASSES =
  "mt-3 rounded border border-border bg-muted/40 px-2.5 py-2"

const DIAL_CLASSES =
  "mt-1.5 inline-flex rounded-full border border-border bg-muted p-[3px]"

const DIAL_BUTTON_BASE =
  "rounded-full px-2.5 py-1 text-[11px] leading-none focus:outline-none focus:ring-1 focus:ring-primary"

/** The ON side. Green is the dial's own reading, not run status — no card colour is spent. */
const DIAL_BUTTON_ON =
  "bg-[hsl(142_71%_45%/0.22)] text-[hsl(142_71%_74%)] shadow-[0_0_0_1px_hsl(142_71%_45%/0.4)]"

const DIAL_BUTTON_OFF = "bg-transparent text-muted-foreground hover:text-foreground"

/** Refused, never hidden — struck through and dimmed, exactly as sketch 142-B locks it. */
const DIAL_BUTTON_REFUSED =
  "cursor-not-allowed line-through opacity-[0.42] bg-transparent text-muted-foreground"

const NOTE_CLASSES = "mt-1.5 text-[10.5px] leading-snug text-muted-foreground"

const REFUSAL_CLASSES = [
  "mt-[11px] rounded-[10px] border px-3 py-2.5 text-[12px] leading-[1.7]",
  "border-[hsl(38_92%_60%/0.34)] bg-[hsl(38_92%_60%/0.1)] text-[hsl(38_92%_78%)]",
].join(" ")

export function GovernanceSection({
  phaseType,
  availableTools,
  kbTools,
  groundingEscalated,
  actionRiskArmed,
  onGovernanceChange,
  citationPolicy,
}: GovernanceSectionProps) {
  const baseId = useId()

  // DERIVED DURING RENDER — not state, not an effect. A tool chip and every governance
  // mark that follows from it therefore land on the same commit (G-4 scenario 1).
  const hasDial = DIAL_TYPES.includes(phaseType)
  const groundingTools = availableTools.filter((tool) => kbTools.includes(tool))

  const detected = hasDial && groundingTools.length > 0
  const alreadySet = phaseType === EMIT_TYPE && citationPolicy === STRICT_POLICY
  // `groundingEscalated` is read ONLY where a dial exists. A stored bit on a type that
  // can never carry the control is inert by the same rule that makes detection win.
  const escalated = hasDial && groundingEscalated

  const cause: GovernanceCause = detected
    ? "detected"
    : alreadySet
      ? "already-set"
      : escalated
        ? "escalated"
        : null

  const strictOn = cause !== null
  const refused = hasDial && detected
  const reasonId = `${baseId}-why-locked`
  const armNoteId = `${baseId}-armed-note`

  return (
    <section
      data-rail="governance"
      data-testid="rail-governance"
      data-cause={cause ?? "none"}
      className={SECTION_CLASSES}
    >
      <h3 className="text-[11px] font-medium text-foreground">{SECTION_HEADING}</h3>

      {hasDial ? (
        <>
          <div
            role="group"
            aria-label={SECTION_HEADING}
            data-testid="governance-dial"
            className={DIAL_CLASSES}
          >
            <button
              type="button"
              data-testid="governance-dial-loose"
              data-dial="free"
              data-refused={refused ? "true" : "false"}
              aria-pressed={!strictOn}
              disabled={refused}
              aria-disabled={refused ? "true" : undefined}
              // The reason is REAL DOM text below, not a title attribute — assistive
              // technology reads the same sentence a sighted author reads.
              aria-describedby={refused ? reasonId : undefined}
              onClick={() => {
                if (refused || !strictOn) return
                onGovernanceChange?.({ grounding_escalated: false })
              }}
              className={[
                DIAL_BUTTON_BASE,
                refused ? DIAL_BUTTON_REFUSED : strictOn ? DIAL_BUTTON_OFF : DIAL_BUTTON_ON,
              ].join(" ")}
            >
              {GROUNDING_DIAL_LOOSE_LABEL}
            </button>
            <button
              type="button"
              data-testid="governance-dial-strict"
              data-dial="proves"
              aria-pressed={strictOn}
              onClick={() => {
                if (strictOn) return
                onGovernanceChange?.({ grounding_escalated: true })
              }}
              className={[DIAL_BUTTON_BASE, strictOn ? DIAL_BUTTON_ON : DIAL_BUTTON_OFF].join(" ")}
            >
              {GROUNDING_DIAL_STRICT_LABEL}
            </button>
          </div>

          {cause !== null && (
            <p data-testid="governance-why" className={NOTE_CLASSES}>
              {cause === "detected" ? GROUNDING_WHY_DETECTED : GROUNDING_WHY_ESCALATED}
            </p>
          )}

          {refused && (
            <p id={reasonId} data-testid="governance-refusal" className={REFUSAL_CLASSES}>
              {GROUNDING_LOCK_REFUSAL}
            </p>
          )}

          <p data-testid="governance-tool-control" className={NOTE_CLASSES}>
            {GROUNDING_TOOL_LIST_IS_THE_CONTROL}
          </p>
        </>
      ) : alreadySet ? (
        <p data-testid="governance-already-set" className={NOTE_CLASSES}>
          {GROUNDING_ALREADY_SET_NOTE}
        </p>
      ) : (
        <p data-testid="governance-nothing" className={NOTE_CLASSES}>
          {GROUNDING_NOTHING_TO_PROVE}
        </p>
      )}

      {(cause === "detected" || cause === "escalated") && (
        <p
          data-testid="governance-attached"
          className="mt-1.5 flex gap-1.5 text-[11px] leading-snug text-foreground"
        >
          <span aria-hidden="true">🔒</span>
          <span className="min-w-0">{GROUNDING_ATTACHED_GATE}</span>
        </p>
      )}

      {/* The action-risk checkpoint — offered on EVERY step type (SPEC Req 8). */}
      <div className="mt-2 border-t border-border pt-2">
        <button
          type="button"
          role="switch"
          data-testid="governance-arm"
          aria-checked={actionRiskArmed}
          aria-describedby={actionRiskArmed ? armNoteId : undefined}
          onClick={() => onGovernanceChange?.({ action_risk_armed: !actionRiskArmed })}
          className={[
            "flex w-full items-center gap-2 rounded border border-border px-2 py-1 text-left",
            "text-[11px] text-foreground hover:bg-accent/40 focus:outline-none focus:ring-1 focus:ring-primary",
          ].join(" ")}
        >
          <span
            aria-hidden="true"
            data-testid="governance-arm-track"
            className={[
              "inline-block h-[13px] w-[24px] shrink-0 rounded-full border border-border",
              actionRiskArmed ? "bg-[hsl(38_92%_60%/0.55)]" : "bg-muted",
            ].join(" ")}
          />
          <span className="min-w-0">{ACTION_RISK_ARM_LABEL}</span>
        </button>

        {/* Said ONLY when armed. An unarmed step must never claim the run waits for it. */}
        {actionRiskArmed && (
          <p id={armNoteId} data-testid="governance-armed-note" className={NOTE_CLASSES}>
            {ACTION_RISK_ARMED_NOTE}
          </p>
        )}
      </div>
    </section>
  )
}

export default GovernanceSection
