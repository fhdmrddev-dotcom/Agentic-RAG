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
 * ── THE ARMING SWITCH REFUSES ON ONE TYPE (Phase 189 / D-04 / D-24) ──
 * The action-risk checkpoint is offered on every step type, and on `external_action` it
 * is STRUCTURALLY armed: the server pins the field, so a control that could be pressed
 * and changed nothing would be a lie. It therefore renders ON, `disabled`, `aria-disabled`
 * and `cursor-not-allowed`, with ONE new sentence — `ACTION_RISK_LOCKED_REFUSAL` — as real
 * DOM text in the shipped refusal block, wired by `aria-describedby`.
 * ⚠ It is NOT struck through and NOT dimmed to the refused-option opacity. Strike-through
 * is 142-B's treatment for a REFUSED OPTION; this control states a fact that is TRUE and
 * ACTIVE. ⚠ And it is not REMOVED either: the "remove a dead control" rule below is really
 * *replace a dead control with the sentence that states the fact*, and this control is not
 * dead — it is pinned, and it displays the most important thing on the panel for this type.
 *
 * ── WHICH STEPS CARRY A DIAL (D-185-15) ──
 * Only `llm_agent` and `llm_batch_agents`. They are the only configs whose tools can ever
 * INTERSECT the server's `KB_TOOLS`, i.e. the only steps that can ever SATISFY the gate.
 * (⚠ CORRECTED at Phase 189 / D-03 / D-26, in the commit that falsified it: this sentence
 * used to say they were the only configs WITH `available_tools`. The 7th type,
 * `external_action`, carries one too — but its list is derived from a capability set that
 * is disjoint from `KB_TOOLS`, so it can neither satisfy nor be detected by this gate, and
 * `DIAL_TYPES` below stays the same two names.) The trap this
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
  ACTION_RISK_LOCKED_REFUSAL,
  GROUNDING_ALREADY_SET_NOTE,
  GROUNDING_ATTACHED_GATE,
  GROUNDING_DIAL_LOOSE_LABEL,
  GROUNDING_DIAL_STRICT_LABEL,
  GROUNDING_LOCK_REFUSAL,
  GROUNDING_NOTHING_TO_PROVE,
  GROUNDING_PUBLISH_CONSEQUENCE,
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
 * these are the only types whose tools can ever INTERSECT the server's `KB_TOOLS`, which
 * is the one thing `grounding_cause` reports `detected` for.
 *
 * ⚠ CORRECTED at Phase 189 (D-03 / D-26), in the commit that falsified it. The reason
 * used to read *"`available_tools` exists only on `LlmAgentPhaseConfig` and
 * `LlmBatchAgentsPhaseConfig`"*, and the 7th phase type `external_action` now carries
 * `available_tools` too (D-03). THE CONSTANT IS UNCHANGED AND STILL CORRECT: that step's
 * list is DERIVED from its `capability` and the three capabilities are disjoint from
 * `KB_TOOLS` by construction, so it can never read as `detected`. Do not add
 * `external_action` here — see `phaseVocabulary.GROUNDING_DIAL_TYPES`, whose docblock
 * carries the same correction and the same red line.
 */
const DIAL_TYPES: readonly string[] = ["llm_agent", "llm_batch_agents"]

/** The deliverable — the one type whose strictness is owned by another control. */
const EMIT_TYPE = "llm_emit"

/**
 * Phase 189 (D-04) — the step types whose action-risk checkpoint is STRUCTURALLY ARMED
 * and cannot be disarmed by anyone. A NAMED module-scope constant, `DIAL_TYPES`' form,
 * because a type gate written as an inline literal at its use site is a gate nobody can
 * find when the eighth type arrives.
 *
 * ⚠ THIS IS NOT `DIAL_TYPES` AND MUST NEVER BE MERGED WITH IT. They answer opposite
 * questions about different fields: `DIAL_TYPES` says which steps can be held to their
 * SOURCES (grounding), and `external_action` is deliberately absent from it — its three
 * capabilities are disjoint from `KB_TOOLS`, so it reads no documents and has nothing to
 * prove. This list says which steps are always ARMED. A step can be one, both or neither.
 *
 * ⚠ AND THE SERVER IS THE GUARANTEE, NOT THIS LINE. `ExternalActionPhaseConfig` pins
 * `action_risk_armed` true at the Pydantic level (189-07); this constant only makes the
 * SURFACE tell the truth about it. Measured, and the reason the pin is needed on the
 * client at all: `minimalPhaseFor("external_action", …)` emits no `action_risk_armed`, so
 * a freshly-placed step arrives with the prop FALSE and the switch would render OFF —
 * the exact lie D-04 exists to prevent — until the definition made a server round trip.
 */
const ARM_PINNED_TYPES: readonly string[] = ["external_action"]

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
   *  egress yet.
   *  ⚠ CORRECTED at Phase 189-14, in the commit that made it true: this sentence used to
   *  predict that *"Phase 189's external-action node arrives armed-on per its SC#2"*. It
   *  does — but NOT through this prop. `ARM_PINNED_TYPES` above decides the rendered
   *  state for that type, because a freshly-placed step has no stored bit yet and the
   *  switch must not read OFF for the interval before its first save (D-04). This prop
   *  stays what it always was: the author's intent on the six types that have one. */
  actionRiskArmed: boolean
  /** D-185-10 — the PhaseSpec-level write, caller-owned. ABSENT ⇒ the section renders
   *  read-only (presses are inert) rather than disappearing, so a dropped wiring is
   *  visible on screen rather than silent. */
  onGovernanceChange?: (patch: GovernancePatch) => void
  /** `llm_emit` only: its shipped `citation_policy`, so the already-set cause can be read
   *  WITHOUT this section owning a second control for it. */
  citationPolicy?: string
}

/**
 * ⚠ 200 (the step-panel port) — THE SHELL WEARS THE SHEET'S CARD SHAPE NOW, and the words
 * inside it did not move. The reference (`screens/step-panel.html`) draws every group as a
 * small-caps outside label over an INSET panel darker than the aside around it; the shipped
 * `bg-muted/40` strip read as a tinted heading, which is the "three headings and a dense
 * form" the operator's verdict named. This section is one of the sheet's seven cards
 * (`How strictly it is held`), so it takes the same shape as its siblings — otherwise the
 * one card carrying the governance decision is the one that does not look like a card.
 *
 * ⚠ `SECTION_HEADING` IS UNTOUCHED. It doubles as the dial group's accessible name and is a
 * `RAIL_MARKERS` entry in `PhaseFormPanel.rails.test.tsx`; only its typography moved.
 */
const SECTION_CLASSES = "mt-3 flex flex-col gap-1.5"

/** The sheet's inset panel — the same two class strings `StepCardSection.tsx` uses. */
const SECTION_BODY_CLASSES = "rounded border border-border bg-background p-3"

const SECTION_HEADING_CLASSES =
  "text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"

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
  const armLockedId = `${baseId}-arm-locked`

  // Phase 189 (D-04). The switch is ON and UNMOVABLE on this type. `armed` is the OR, not
  // the prop, because the pinned value is a fact about the TYPE that the stored bit merely
  // echoes — a step that has not round-tripped the server yet would otherwise render its
  // single most important guarantee as switched off.
  const armPinned = ARM_PINNED_TYPES.includes(phaseType)
  const armed = armPinned || actionRiskArmed

  return (
    <section
      data-rail="governance"
      data-testid="rail-governance"
      data-cause={cause ?? "none"}
      className={SECTION_CLASSES}
    >
      <h3 className={SECTION_HEADING_CLASSES}>{SECTION_HEADING}</h3>
      <div className={SECTION_BODY_CLASSES}>

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

          {/* ── SEED-230 — WHAT THE STATE DOES, not just what it is ──────────────────────
              Everything above describes a state; nothing said it can stop a publish, so the
              section reads as a quality setting. `detected` ONLY: `effective_phase`
              synthesizes the gate for that cause and no other, so rendering this on
              `escalated` would promise a check that is never attached. */}
          {cause === "detected" && (
            <p data-testid="governance-publish-consequence" className={NOTE_CLASSES}>
              {GROUNDING_PUBLISH_CONSEQUENCE}
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

      {/* The action-risk checkpoint — offered on EVERY step type (SPEC Req 8), and on ONE
          of them (D-04) it is ON and REFUSES TO MOVE. */}
      <div className="mt-2 border-t border-border pt-2">
        <button
          type="button"
          role="switch"
          data-testid="governance-arm"
          data-arm-pinned={armPinned ? "true" : "false"}
          aria-checked={armed}
          disabled={armPinned}
          aria-disabled={armPinned ? "true" : undefined}
          // The reason is REAL DOM text below, never a `title` attribute (the 184-07
          // lesson). When the switch is pinned a screen reader reaches BOTH sentences:
          // why it cannot be removed, and what it costs.
          aria-describedby={
            armPinned ? `${armLockedId} ${armNoteId}` : armed ? armNoteId : undefined
          }
          onClick={() => {
            // Belt as well as braces. `disabled` already stops the press in a real
            // browser; this makes the refusal true of the HANDLER too, so a control
            // rendered another way can still never write the disarmed intent.
            if (armPinned) return
            onGovernanceChange?.({ action_risk_armed: !actionRiskArmed })
          }}
          className={[
            "flex w-full items-center gap-2 rounded border border-border px-2 py-1 text-left",
            "text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary",
            // ⚠ NOT `DIAL_BUTTON_REFUSED`. Strike-through and the 0.42 dim are 142-B's
            // treatment for a REFUSED OPTION; this control states a fact that is TRUE and
            // ACTIVE, and striking it would read as "this protection is off" — the exact
            // opposite of what it says. Only the cursor and the hover change.
            armPinned ? "cursor-not-allowed" : "hover:bg-accent/40",
          ].join(" ")}
        >
          <span
            aria-hidden="true"
            data-testid="governance-arm-track"
            className={[
              "inline-block h-[13px] w-[24px] shrink-0 rounded-full border border-border",
              armed ? "bg-[hsl(38_92%_60%/0.55)]" : "bg-muted",
            ].join(" ")}
          />
          <span className="min-w-0">{ACTION_RISK_ARM_LABEL}</span>
        </button>

        {/* D-04 / D-24 — refused, never hidden. The shipped amber refusal block, the same
            one the locked grounding dial uses one scroll up. The control is NOT removed:
            185's "a control that could never do anything is REMOVED, not disabled" is
            really *replace a DEAD control with the sentence that states the fact*, and
            this one is not dead — it displays the single most important thing on the
            panel for this type, so hiding it would delete the reading at the moment it
            matters most (143-A's argument for the seal, one surface along). */}
        {armPinned && (
          <p id={armLockedId} data-testid="governance-arm-refusal" className={REFUSAL_CLASSES}>
            {ACTION_RISK_LOCKED_REFUSAL}
          </p>
        )}

        {/* Said ONLY when armed. An unarmed step must never claim the run waits for it. */}
        {armed && (
          <p id={armNoteId} data-testid="governance-armed-note" className={NOTE_CLASSES}>
            {ACTION_RISK_ARMED_NOTE}
          </p>
        )}
      </div>
      </div>
    </section>
  )
}

export default GovernanceSection
