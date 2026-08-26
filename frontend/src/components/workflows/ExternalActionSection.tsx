/**
 * Phase 189-14 Task 1 (CONN-01 / D-02 / D-15 / D-23, UI-SPEC §7a-§7b) —
 * ExternalActionSection: the capability picker for the 7th step type.
 *
 * ── WHY THIS IS ITS OWN FILE, AND THE PANEL GETS ONE GATED LINE ──
 * `PhaseFormPanel.tsx` is on the hot-file ledger and its row says, verbatim: *"Keep this
 * shape — the next surface that needs the panel gets its own component and one gated
 * line."* Phase 185 proved the shape at FOUR insertions in that panel's render body for a
 * whole governance feature (`GovernanceSection.tsx`, 321 L, mounted in one expression).
 * 189 is the next surface, so this file is `GovernanceSection.tsx`'s whole-file shape
 * copied deliberately, property by property, and the panel-side cost is one import plus
 * one gated JSX expression.
 *
 * ── THIS COMPONENT AUTHORS NO SENTENCE OF ITS OWN, AND CONSULTS NO SERVER ──
 * Every user-visible string is an identifier imported from `definitionOps` (the heading
 * and the no-capability note) or from `phaseVocabulary` (the three capability labels).
 * Its suite asserts character-identity against those names, because a sentence that lives
 * inside a component is a sentence nobody can test for drift. This module imports nothing
 * from the API client, names no route and opens no request; a `?raw` fence in
 * `ExternalActionSection.test.tsx` proves it, with a positive control.
 *
 * ── D-23 · THE THREE OPTIONS ARE A CLIENT MIRROR, AND THE MIRROR IS FENCED ──
 * `PhaseFormPanel.tsx`'s tool-rail docblock states a rule that reads like it forbids this
 * component outright: *"THE OPTION SET IS THE SERVER'S… There is no frontend list of tool
 * ids here or anywhere upstream of here."* That rule is about the WHITELIST RAIL, whose
 * options arrive on `GroundingBundle.tools`, and D-20 deliberately keeps these three
 * capability names OFF that bundle — precisely so an author can never whitelist an
 * external capability onto an unarmed `llm_agent` step. So no shipped surface sources
 * these three a third way, and the exit taken is the one `definitionOps.PhaseTypeId`
 * already licenses: a CLIENT MIRROR of a backend `Literal`, justified as a *union mirror*
 * rather than as an options source. A new route and field for three constants is
 * infrastructure this phase does not need, and any server-supplied capability list is one
 * refactor away from being reused as an author-facing options source — which is the leak
 * shape 189-04 closed and `test_182_grounding_bundle.py`'s V22 guards.
 *
 * ⚠ THE ANTI-DRIFT GUARANTEE IS MECHANICAL, NOT EDITORIAL. A docblock claiming "this
 * mirrors `harness.py`" is a claim; the suite's cross-language fence is a check — it reads
 * `backend/app/models/harness.py` as raw source, extracts the `capability` Literal's
 * members, and asserts they equal `EXTERNAL_ACTION_CAPABILITIES` exactly. It was observed
 * RED against a planted mismatch before it was trusted.
 *
 * ── ONE CONSTANT READ TWICE, NEVER TWO COPIES ──
 * The picker's labels and the node face's sentences are the SAME
 * `EXTERNAL_CAPABILITY_SENTENCES` map (`phaseVocabulary.ts`), derived here rather than
 * re-typed. That is what makes "the row previews the card that lands" true by
 * construction instead of by review.
 *
 * ── THE RAW CAPABILITY ID NEVER REACHES THE DOM ──
 * The author reads sentences; the ids are wire values. Nothing here renders a capability
 * id as a value, a `data-` attribute or a test id, and `PhaseFormPanel.rails.test.tsx`
 * asserts the whole external-action panel's HTML contains none of the three — the D-20
 * boundary restated as an observable, so a capability can never be painted as an
 * author-fixable tool chip.
 *
 * A LEAF, not a wired surface: presentational and caller-driven. It reads no context,
 * fetches nothing, holds no store reference, and its only write is one capability name
 * handed back to the caller, which patches `config` through the panel's single seam.
 */
import { useId, useRef, useState } from "react"

import {
  EXTERNAL_ACTION_HEADING,
  EXTERNAL_ACTION_NOTHING_CHOSEN_NOTE,
} from "@/components/workflows/definitionOps"
import {
  EXTERNAL_SHAPE_CAPABILITY_LABEL,
  EXTERNAL_SHAPE_GROUP_LABEL,
  EXTERNAL_SHAPE_MCP_LABEL,
  type ExternalActionShape,
} from "@/components/workflows/externalShapeVocabulary"
import { EXTERNAL_CAPABILITY_SENTENCES } from "@/components/workflows/phaseVocabulary"
import { ConnectionPicker } from "./ConnectionPicker"

/**
 * The CLOSED client mirror of `ExternalActionPhaseConfig.capability`
 * (`backend/app/models/harness.py`), in the backend `Literal`'s own order.
 *
 * DERIVED from the one sentence map rather than re-typed, so the picker cannot offer a
 * name the node face has no words for, and a fourth entry cannot appear on one side
 * alone. A NAMED module-scope constant, never an inline literal at a use site — the
 * `GovernanceSection.DIAL_TYPES` form.
 *
 * ⚠ NOT EXPORTED, and the reason is mechanical rather than stylistic: a runtime export
 * beside a component is a `react-refresh/only-export-components` lint ERROR (measured —
 * `GovernanceSection.tsx` exports two components and two TYPES, and no const). The suite
 * therefore reads the mirror from its ONE home, `EXTERNAL_CAPABILITY_SENTENCES`, which is
 * the same object this line reads — so the cross-language fence still compares the
 * client's closed set against the server's `Literal`, and the source fence below it
 * proves THIS component derives from that constant rather than re-typing the three ids.
 */
const EXTERNAL_ACTION_CAPABILITIES: readonly string[] = Object.keys(
  EXTERNAL_CAPABILITY_SENTENCES,
)

/**
 * 206.2-03 (D-206.2-01 / UI-SPEC § Surface 1) — THE SECOND AXIS, and why it is a second
 * axis rather than a fourth row.
 *
 * An `external_action` step reaches outside in one of TWO shapes: one of the closed set of
 * first-party actions, or a named tool on a remote MCP server. Those are two different
 * QUESTIONS, not four answers to one — and modelling the MCP shape as a fourth member of
 * the closed set is refused in four independent places, three of them in another language
 * and one of them in the database (see `externalShapeVocabulary.ts` §(a)).
 *
 * So this control is its own `radiogroup`, with its own accessible name and its own test
 * id, and NEITHER of its two buttons is a `role="radio"` child of the capability group.
 * Five shipped assertions pin that group's children at exactly three, and they pass here
 * with an empty diff — which is the assertion, not a side effect.
 *
 * ⚠ A DIFFERENT FIRST DRAFT — *hide the capability rows until a shape is chosen* — turns
 * all five red, and it looks like the more honest design. It is recorded as REFUTED so it
 * is not rediscovered: the capability rows render under BOTH `unset` and `capability`.
 */
const SHAPE_POSITIONS: readonly { shape: ExternalActionShape; label: string }[] = [
  { shape: "capability", label: EXTERNAL_SHAPE_CAPABILITY_LABEL },
  { shape: "mcp", label: EXTERNAL_SHAPE_MCP_LABEL },
]

export interface ExternalActionSectionProps {
  /** The step's stored `capability`, already resolved to a string by the caller.
   *  `""` (absent) and an UNRECOGNISED value both select NOTHING — see below. */
  capability: string
  /**
   * The step's stored `tool_name`, already resolved to a string by the caller.
   *
   * The shape's OTHER derivation input. A non-empty value means the step is MCP-shaped,
   * because that is exactly what the executor decides on: it branches on `tool_name`
   * FIRST and only falls to the closed-set check when it is absent
   * (`phase_types.py:2288`). Deriving the shape from any other fact would be the client
   * disagreeing with the thing that actually runs.
   */
  toolName: string
  /** The panel's config write seam. Receives the capability NAME, never a sentence. */
  onChange: (value: string) => void
  /**
   * The panel's OWN patch-shaped writer, forwarded WHOLE.
   *
   * ⚠ IT EXISTS BECAUSE `onChange` ABOVE CANNOT CARRY THIS WRITE. The panel builds that
   * one with `set(key) => (v) => onChange({[key]: v})` — SINGLE-KEY BY CONSTRUCTION — and a
   * shape switch is a multi-key patch. Widening `onChange` instead would move eight shipped
   * assertions that call it with a bare string, so the multi-key write gets its own door.
   *
   * ⚠ AND IT IS THE ONLY PLACE IN THE FRONTEND WHERE A CONFIG KEY IS CLEARED. Measured: no
   * shipped code in `src` clears a key inside `config` — the merge below is a pure spread
   * and nothing normalises. That is why the clear is authored here, once, at the one site
   * that knows which shape was just abandoned.
   *
   * ⚠ NOT the picker's `bind()` and NOT the merge itself. The picker's suite sweeps every
   * patch its control emits and asserts the key set is exactly `["connection_id"]`; the
   * merge is shared by six surfaces and its own docblock says it is a mechanism, not a
   * policy.
   */
  onChangeShape: (patch: Record<string, unknown>) => void
  /** The panel's commit seam. Called after `onChange` because a set of rows has no
   *  blur event to hang the commit on, and the store's patch is synchronous. */
  onPersist: () => void
}

const SECTION_CLASSES = "col-span-2 rounded border border-border bg-muted/40 px-2.5 py-2"

const OPTION_LIST_CLASSES = "mt-1.5 flex flex-col gap-1"

const OPTION_BASE =
  "flex w-full items-center gap-2 rounded border px-2 py-1 text-left text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"

/** The chosen row. The dial's green is the panel's own "this is set" reading. */
const OPTION_SELECTED =
  "border-[hsl(142_71%_45%/0.4)] bg-[hsl(142_71%_45%/0.14)] text-foreground"

const OPTION_UNSELECTED = "border-border bg-card text-muted-foreground hover:text-foreground"

const MARK_BASE = "inline-block h-[9px] w-[9px] shrink-0 rounded-full border border-border"

const MARK_SELECTED = "bg-[hsl(142_71%_45%/0.75)]"

const MARK_UNSELECTED = "bg-transparent"

const NOTE_CLASSES = "mt-1.5 text-[10.5px] leading-snug text-muted-foreground"

/**
 * The shape control's recessed track.
 *
 * ⚠ PER-SITE SPACING NOTE (UI-SPEC § Spacing, the phase's ONE new node on a declared
 * exception). The 6px top gap below is NOT a multiple of 4. It is taken deliberately and
 * it is bounded: the exception is the step panel's shipped dense rhythm, this is the SAME
 * KIND of site it already occupies here — heading → control — and that value already ships
 * at five sites in this radius. The on-grid alternative (`mt-2`, 8px) would put this control 2px out of step
 * with four siblings, so the "correct" value is the one that would look wrong. **No other
 * new node in this phase spends 6px.** Re-open trigger: *a wholesale redesign of this 400px
 * panel*, which is also when the 10 / 10.5px near-duplicate type steps should collapse.
 *
 * `p-1` / `gap-1` are 4px — deliberately NOT the 2px inset of the admin analog this control
 * copies its STRUCTURE from, which is off this project's grid and is not on this surface.
 */
const SHAPE_GROUP_CLASSES =
  "mt-1.5 flex w-full items-center gap-1 rounded border border-border bg-background/60 p-1"

/**
 * One segment.
 *
 * NON-COLOUR DIFFERENTIATOR (WCAG 1.4.1): the chosen segment is OUTLINED and RAISED, the
 * other is neither. Remove every colour from this surface and the control still reads —
 * which is the same bar the four connection-state words already meet. `aria-checked` and
 * `data-chosen` carry the same fact to a machine.
 *
 * ⚠ NO ACCENT. The reserved accent list on this surface is exactly two entries (the focus
 * ring, and one glyph in a sibling's heading); a third KIND of accent site is a contract
 * violation, so the selected segment is `bg-card` and never tinted.
 */
const SHAPE_OPTION_BASE =
  "flex-1 rounded border px-2 py-1 text-[11px] leading-snug focus:outline-none focus:ring-1 focus:ring-primary"

const SHAPE_OPTION_SELECTED = "border-border bg-card font-medium text-foreground"

const SHAPE_OPTION_UNSELECTED =
  "border-transparent bg-transparent text-muted-foreground hover:text-foreground"

export function ExternalActionSection({
  capability,
  toolName,
  onChange,
  onChangeShape,
  onPersist,
}: ExternalActionSectionProps) {
  const headingId = useId()
  // ── REVIEW FINDING WR-04 · THE ROLE PROMISED A WIDGET THE OPTIONS DID NOT BEHAVE LIKE ──
  // The container declared `role="radiogroup"` and each option `role="radio"` with
  // `aria-checked`, but they were plain buttons: no tabIndex management and no onKeyDown.
  // The APG radio-group pattern requires ONE tab stop for the group with Arrow keys moving
  // the selection; a keyboard user got THREE tab stops and no arrow behaviour, so the ARIA
  // announced a widget that did not exist. `vitest-axe` cannot see this —
  // `aria-required-children` and `aria-checked` are both satisfied — which is why the
  // suite's a11y coverage passed straight over it.
  //
  // The review offered two shapes. The role is KEPT and the behaviour built, rather than
  // retracting to `aria-pressed` buttons in a `role="group"`: this genuinely IS a
  // single-choice group, `role="group"` would make no promise but would also describe it
  // less well, and every existing assertion in the suite (five `getByRole("radio")` call
  // sites plus the `radiogroup` case) stays true instead of being rewritten. This is the
  // first real radiogroup on the surface, so the pattern debt is paid at its start.
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])

  // DERIVED DURING RENDER. An unrecognised or absent stored value selects NOTHING and
  // NEVER fabricates a row — the picker half of the same rule `derivedFace` applies to
  // the node face, which falls through to the type sentence for exactly these values.
  const selected = EXTERNAL_ACTION_CAPABILITIES.includes(capability) ? capability : null

  const selectedIndex = selected === null ? -1 : EXTERNAL_ACTION_CAPABILITIES.indexOf(selected)

  const shapeRefs = useRef<Array<HTMLButtonElement | null>>([])

  // ── THE ONE SESSION FACT ON THIS LEAF: which segment the author pressed, or none ──
  //
  // It is a SESSION fact, not a stored one. The stored facts are `capability` and
  // `toolName`, both props, and both derive the shape on their own — this exists only for
  // the moment between "the author said MCP" and "a tool has been named", during which the
  // config carries neither answer and the surface must still show what was asked for.
  //
  // ⚠ AND IT IS WHY THE CALLER MOUNTS THIS SECTION WITH A PER-STEP `key`. Without one the
  // press LEAKS ACROSS STEPS: choose MCP on step 3, select step 4, and step 4 renders in a
  // shape it never chose. This file's own source fence forbids the four hook names that
  // could reset it on a prop change, so a remount is not a convenience here — it is the
  // only mechanism available, and the caller owns it.
  const [pressed, setPressed] = useState<ExternalActionShape | null>(null)

  // ── THE THREE-STATE DERIVATION (UI-SPEC § The three states) ──────────────────────────
  //
  // ⚠ `unset` LEAVES BOTH SEGMENTS UNCHECKED, and that is the honesty decision of this
  // surface. Defaulting segment A would make a brand-new step assert "this step does one of
  // these three actions" before anyone said so — the same fabrication the node face refuses
  // when it falls through to the type sentence, and the same one the backend paid for when
  // `capability` carried a default: A DEFAULT IS NOT A WAY THROUGH A GATE.
  //
  // A stored answer derives the shape; a press this session overrides it, because the press
  // is what cleared the other shape's keys and the props have not come back yet.
  const storedShape: ExternalActionShape | null =
    toolName.trim() !== "" ? "mcp" : selected !== null ? "capability" : null

  const shape: ExternalActionShape | "unset" = pressed ?? storedShape ?? "unset"

  const shapeIndex = SHAPE_POSITIONS.findIndex((position) => position.shape === shape)

  /**
   * Answer the shape question — the ONE site in the frontend where a config key is cleared.
   *
   * ⚠ THE ASYMMETRY IS THE FINDING, AND THE `capability` DIRECTION IS THE ONE THAT MUST NOT
   * BE SKIPPED. The executor branches on `tool_name` FIRST (`phase_types.py:2288`), so a
   * stranded `capability` on an MCP step is INERT — but a stranded `tool_name` on a
   * capability step SILENTLY TURNS AN EMAIL STEP INTO AN MCP STEP, and the server's derived
   * tool grant follows the tool rather than the capability. Nothing in the UI would say so.
   * The comment the executor carries at that line is the reason both directions are written
   * here rather than only the visible one: *a default is not a way through a gate.*
   *
   * ⚠ `tool_name` AND `tool_args` CLEAR AS A SET. Clearing the name without the arguments
   * leaves arguments for a tool that no longer exists — the merge module's own
   * clear-the-PAIR-never-half-of-it reasoning, one object down.
   *
   * ⚠ BOTH DIRECTIONS ALSO CLEAR `connection_id`, AND NO UPSTREAM DOCUMENT NAMED THIS
   * BEFORE THE UI CONTRACT DID. The bound connection belongs to the OTHER shape. Left
   * behind, the picker shows its unbound reading (the id is not in the newly-filtered list)
   * while the SAVED definition still carries it, and the executor really resolves a
   * connection of the wrong kind. It is `null`, not `undefined`, because `null` is what the
   * shipped unbind writes and two spellings of "unbound" is how two readers come to
   * disagree.
   *
   * ⚠ THE CONTRACT IS ON THE SERIALIZED DEFINITION, NOT ON THE STORE OBJECT. The merge is a
   * spread, so `{...cfg, capability: undefined}` leaves the KEY PRESENT in memory with an
   * `undefined` value; only `JSON.stringify` drops it on the way to the server. That is
   * RESEARCH assumption A1, and this plan's suite falsifies it against a real store rather
   * than asserting it.
   */
  const chooseShape = (index: number) => {
    const position = SHAPE_POSITIONS[index]
    if (position === undefined) return
    shapeRefs.current[index]?.focus()
    if (position.shape === shape) return
    setPressed(position.shape)
    onChangeShape(
      position.shape === "mcp"
        ? { capability: undefined, connection_id: null }
        : { tool_name: undefined, tool_args: undefined, connection_id: null },
    )
    onPersist()
  }

  /** The shape group's own key handling — the shipped capability group's behaviour, copied,
   *  because a second radiogroup on the same surface behaving differently is the WR-04
   *  defect ("the role announced a widget that did not exist") a second time. */
  const onShapeKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = SHAPE_POSITIONS.length - 1
    let next: number | null = null
    if (event.key === "ArrowDown" || event.key === "ArrowRight") next = index === last ? 0 : index + 1
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = index === 0 ? last : index - 1
    else if (event.key === "Home") next = 0
    else if (event.key === "End") next = last
    if (next === null) return
    event.preventDefault()
    chooseShape(next)
  }

  /** Commit a row and move DOM focus onto it — APG "selection follows focus". */
  const choose = (index: number) => {
    const name = EXTERNAL_ACTION_CAPABILITIES[index]
    if (name === undefined) return
    optionRefs.current[index]?.focus()
    if (name === selected) return
    onChange(name)
    onPersist()
  }

  const onOptionKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = EXTERNAL_ACTION_CAPABILITIES.length - 1
    // Down/Right advance, Up/Left retreat, both WRAPPING — the APG default. Home/End are
    // the pattern's optional pair and are cheap enough to be worth having.
    let next: number | null = null
    if (event.key === "ArrowDown" || event.key === "ArrowRight") next = index === last ? 0 : index + 1
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = index === 0 ? last : index - 1
    else if (event.key === "Home") next = 0
    else if (event.key === "End") next = last
    if (next === null) return
    // Arrow keys inside a radiogroup must not also scroll the panel behind it.
    event.preventDefault()
    choose(next)
  }

  return (
    <section
      data-section="external-action"
      // ⚠ `capability` HERE IS PROSE, NOT A CAPABILITY NAME. Two shipped fences sweep this
      // panel's HTML and this file's source for the three capability IDS; this attribute
      // names an AXIS, and a reader checking those fences should not have to wonder.
      data-shape={shape}
      data-testid="external-action-section"
      className={SECTION_CLASSES}
    >
      <h3 id={headingId} className="text-[11px] font-medium text-foreground">
        {EXTERNAL_ACTION_HEADING}
      </h3>

      {/* AXIS 1 — the shape question, ABOVE the capability rows and never inside them.
          ⚠ IT GENERATES NO REACT ID AT ALL: the group is named by `aria-label` from an
          imported constant. That is load-bearing rather than frugal — the picker below
          generates two, both of which reach the DOM, so a third generated above them would
          shift React's ids and force the byte-identity pin's counted normalization (measured at
          2, or 4 when the refusal shows) to be re-derived for a reason that has nothing to
          do with the picker. Re-open trigger: *the first phase that needs a visible label
          element for this group rather than an `aria-label`.*
          ⚠ AND NO MARK. The 9px dot below is the ANSWER vocabulary — it means *this is the
          capability you chose*. This control asks which QUESTION is being answered, and a
          second dot two lines up would make one mark mean two things. Re-open trigger: *a
          usability finding that the segmented control does not read as selectable without
          one.* */}
      <div
        role="radiogroup"
        aria-label={EXTERNAL_SHAPE_GROUP_LABEL}
        data-testid="external-action-shape-group"
        className={SHAPE_GROUP_CLASSES}
      >
        {SHAPE_POSITIONS.map((position, index) => {
          const chosen = position.shape === shape
          return (
            <button
              key={position.shape}
              type="button"
              role="radio"
              aria-checked={chosen}
              // The shipped roving-tabindex rule, copied verbatim in behaviour: the checked
              // segment owns the group's one stop, and with NEITHER checked the first does,
              // so the group is always reachable and never adds a second trap to the
              // panel's tab order.
              tabIndex={chosen || (shapeIndex === -1 && index === 0) ? 0 : -1}
              ref={(el) => {
                shapeRefs.current[index] = el
              }}
              data-testid="external-action-shape-option"
              data-chosen={chosen ? "true" : "false"}
              onKeyDown={(event) => onShapeKeyDown(event, index)}
              onClick={() => chooseShape(index)}
              className={[
                SHAPE_OPTION_BASE,
                chosen ? SHAPE_OPTION_SELECTED : SHAPE_OPTION_UNSELECTED,
              ].join(" ")}
            >
              {position.label}
            </button>
          )
        })}
      </div>

      {/* AXIS 2a — rendered under BOTH `unset` and `capability`, which is what keeps the
          five shipped `=== 3` assertions green with an empty diff. */}
      {shape !== "mcp" && (
      <div
        role="radiogroup"
        aria-labelledby={headingId}
        data-testid="external-action-options"
        className={OPTION_LIST_CLASSES}
      >
        {EXTERNAL_ACTION_CAPABILITIES.map((name, index) => {
          const chosen = name === selected
          return (
            <button
              key={name}
              type="button"
              role="radio"
              aria-checked={chosen}
              // ROVING TABINDEX (WR-04) — the group is ONE tab stop. The chosen row owns
              // it; with nothing chosen the FIRST row does, so the group is always
              // reachable and never traps three stops in the panel's tab order.
              tabIndex={chosen || (selectedIndex === -1 && index === 0) ? 0 : -1}
              ref={(el) => {
                optionRefs.current[index] = el
              }}
              data-testid="external-action-option"
              data-chosen={chosen ? "true" : "false"}
              onKeyDown={(event) => onOptionKeyDown(event, index)}
              onClick={() => {
                if (chosen) return
                onChange(name)
                onPersist()
              }}
              className={[OPTION_BASE, chosen ? OPTION_SELECTED : OPTION_UNSELECTED].join(" ")}
            >
              <span
                aria-hidden="true"
                className={[MARK_BASE, chosen ? MARK_SELECTED : MARK_UNSELECTED].join(" ")}
              />
              <span className="min-w-0">{EXTERNAL_CAPABILITY_SENTENCES[name]}</span>
            </button>
          )
        })}
      </div>
      )}

      {shape === "capability" && selected !== null && <ConnectionPicker capability={selected} />}
      {/* AXIS 2b — the MCP shape's own second question, answered by the same picker in its
          other shape. ⚠ NO CONSEQUENCE SENTENCE AND NO CANVAS CHANGE accompany it, both
          deliberately: the consequence line renders nothing for a step with no capability
          (its own docblock argues why a blank consequence row is indistinguishable from a
          failed lookup), and the node face falls through to the type sentence, which is
          honest and identical for every MCP step. Both are flagged in this plan's summary,
          because the first UAT round would otherwise report them as bugs. */}
      {shape === "mcp" && <ConnectionPicker shape="mcp" />}
      {/* Said ONLY when no row is selected — the empty/no-capability note by name
          (UI-SPEC §9d). A step with a capability chosen still sends nothing in 189, and
          that fact is carried where D-12 and D-16 put it: the canvas badge at design
          time and the run word at run time. Repeating it here would be the sentence that
          becomes a lie the day Phase 190 wires the node up. */}
      {shape !== "mcp" && selected === null && (
        <p data-testid="external-action-nothing-chosen" className={NOTE_CLASSES}>
          {EXTERNAL_ACTION_NOTHING_CHOSEN_NOTE}
        </p>
      )}
    </section>
  )
}

export default ExternalActionSection
