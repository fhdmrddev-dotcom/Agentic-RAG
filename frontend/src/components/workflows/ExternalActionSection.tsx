/**
 * Phase 189-14 Task 1 (CONN-01 / D-02 / D-15 / D-23, UI-SPEC §7a-§7b) —
 * ExternalActionSection: the external step's one question, then its one question.
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
 * Every user-visible string is an identifier imported from `definitionOps`. Its suite
 * asserts character-identity against those names, because a sentence that lives inside a
 * component is a sentence nobody can test for drift. This module imports nothing from the
 * API client, names no route and opens no request; a `?raw` fence in
 * `ExternalActionSection.test.tsx` proves it, with a positive control.
 *
 * ── D-23 · THE CLOSED CLIENT MIRROR, AND ITS FENCE, BOTH STAY ──
 * `EXTERNAL_ACTION_CAPABILITIES` below is a CLIENT MIRROR of `harness.py`'s `capability`
 * `Literal`, derived from the one sentence map rather than re-typed. Its cross-language
 * fence reads the backend source and asserts the two agree exactly.
 *
 * ⚠ 211-04 — THE MIRROR AND ITS FENCE ARE KEPT ON PURPOSE, EVEN THOUGH THE RADIO GROUP THAT
 * CONSUMED THEM IS GONE. Removing a guard while "demoting" the thing it guards is this
 * phase's named anti-pattern: *optional* and *closed* are independent properties, and this
 * phase touches neither. The mirror still has a live consumer here — `selected` below, which
 * is what makes an UNRECOGNISED stored capability derive nothing rather than a fabricated
 * reading — and the fence still fails RED if `harness.py` gains, loses or reorders a member.
 *
 * ── ⚠ 211-04 (SC#3 / CONN-05 / SEED-207) · WHAT THIS SECTION STOPPED ASKING ──
 * Until this plan the section opened with TWO radiogroups: a two-segment SHAPE control
 * (*"How this step reaches outside"*) and, under it, three capability rows labelled *Send an
 * email* / *Create a ticket* / *Post a message*. Both are deleted. They were, verbatim,
 * SC#3's *"offered Message / Ticket / Email as a category"* — an author was made to classify
 * their own intent before being shown a single connection, and a connection that did not fit
 * one of the three had nowhere to appear.
 *
 * What replaces them is ONE QUESTION, THEN ONE QUESTION: pick a connection (every shape, one
 * unscoped read), then pick one of that connection's own actions. The verb survives as an
 * ATTRIBUTE of the row — a first-party connection's action IS its capability, which is
 * exactly what migration 127 §2b's descriptor advertises — and stops being an axis.
 *
 * ── THE RAW CAPABILITY ID NEVER REACHES THE DOM FROM THIS FILE ──
 * The author reads sentences; the ids are wire values. Nothing here renders a capability
 * id as a value, a `data-` attribute or a test id.
 *
 * A LEAF, not a wired surface: presentational and caller-driven. It reads no context,
 * fetches nothing and holds no store reference.
 */
import { useId } from "react"

import {
  EXTERNAL_ACTION_HEADING,
  EXTERNAL_ACTION_NOTHING_CHOSEN_NOTE,
} from "@/components/workflows/definitionOps"
import { type ExternalActionShape } from "@/components/workflows/externalShapeVocabulary"
import { EXTERNAL_CAPABILITY_SENTENCES } from "@/components/workflows/phaseVocabulary"
import { ConnectionPicker } from "./ConnectionPicker"

/**
 * The CLOSED client mirror of `ExternalActionPhaseConfig.capability`
 * (`backend/app/models/harness.py`), in the backend `Literal`'s own order.
 *
 * DERIVED from the one sentence map rather than re-typed, so a fourth entry cannot appear on
 * one side alone. A NAMED module-scope constant, never an inline literal at a use site — the
 * `GovernanceSection.DIAL_TYPES` form.
 *
 * ⚠ NOT EXPORTED, and the reason is mechanical rather than stylistic: a runtime export
 * beside a component is a `react-refresh/only-export-components` lint ERROR (measured —
 * `GovernanceSection.tsx` exports two components and two TYPES, and no const). The suite
 * therefore reads the mirror from its ONE home, `EXTERNAL_CAPABILITY_SENTENCES`, which is
 * the same object this line reads.
 */
const EXTERNAL_ACTION_CAPABILITIES: readonly string[] = Object.keys(
  EXTERNAL_CAPABILITY_SENTENCES,
)

export interface ExternalActionSectionProps {
  /** The step's stored `capability`, already resolved to a string by the caller.
   *  `""` (absent) and an UNRECOGNISED value both derive NOTHING — see below. */
  capability: string
  /**
   * The step's stored `tool_name`, already resolved to a string by the caller.
   *
   * The shape's OTHER derivation input. A non-empty value means the step is MCP-shaped,
   * because that is exactly what the executor decides on.
   */
  toolName: string
  /**
   * ⚠ 211-04 SHIPPED THREE DEAD WRITE SEAMS HERE — a value write, a multi-key shape patch and
   * a persist call — AND 214-07 REMOVED THEM, ON THEIR OWN RECORDED TRIGGER RATHER THAN ON A
   * WHIM. ⚠ THEIR IDENTIFIERS ARE DELIBERATELY NOT SPELLED IN THIS FILE ANY MORE: the phase's
   * acceptance for the removal is a mechanical grep, and a docblock naming them would read to
   * that sweep as a survivor (the 187-24 trap, which fired four times in this phase's first
   * wave). The three names are recorded in `214-07-SUMMARY.md` and in the git history.
   *
   * Their docblock read, verbatim: *"They stay in the prop contract because removing them
   * would edit `PhaseFormPanel.tsx`, which is outside this plan's `files_modified` […]
   * RE-OPEN TRIGGER: the first phase whose `files_modified` names `PhaseFormPanel.tsx` — at
   * which point all three come out in one commit, with the panel's call site."*
   *
   * ⭐ THIS IS THAT PHASE, AND THEY CAME OUT IN THAT COMMIT, WITH THAT CALL SITE. The writes
   * they used to carry have lived in `ConnectionPicker` since 211-04 — the only child on this
   * surface holding a store reference — and this component's own source fence forbids the four
   * hook names that would let it hold one. So the panel's contract gets SMALLER in the same
   * edit that gives the panel one new line, which is the direction the hot-file ledger's
   * standing order on that file asks for.
   *
   * ⛔ NOTHING REPLACES THEM. A prop re-added here without a caller is the same debt under a
   * newer date.
   */
}

const SECTION_CLASSES = "col-span-2 rounded border border-border bg-muted/40 px-2.5 py-2"

const NOTE_CLASSES = "mt-1.5 text-[10.5px] leading-snug text-muted-foreground"

export function ExternalActionSection({ capability, toolName }: ExternalActionSectionProps) {
  const headingId = useId()

  // DERIVED DURING RENDER. An unrecognised or absent stored value derives NOTHING and
  // NEVER fabricates a row — the same rule `derivedFace` applies to the node face, which
  // falls through to the type sentence for exactly these values.
  const selected = EXTERNAL_ACTION_CAPABILITIES.includes(capability) ? capability : null

  // ── THE DERIVED READING (UI-SPEC § The three states) ─────────────────────────────────
  //
  // ⚠ 211-04 — THIS IS NOW A READING, NOT AN ANSWER. It used to be *the state of a control
  // the author operated*, with a session fact overriding the stored one for the moment
  // between "the author said MCP" and "a tool has been named". There is no such control and
  // no such moment: the two stored facts are the only inputs, so the session state and the
  // `key`-based reset it forced on the caller are both gone.
  //
  // ⚠ `unset` STILL LEAVES THE ATTRIBUTE HONEST rather than defaulting to a shape. A default
  // would make a brand-new step assert something before anyone said so — the same fabrication
  // the node face refuses when it falls through to the type sentence, and the same one the
  // backend paid for when `capability` carried a default: A DEFAULT IS NOT A WAY THROUGH A
  // GATE.
  const shape: ExternalActionShape | "unset" =
    toolName.trim() !== "" ? "mcp" : selected !== null ? "capability" : "unset"

  return (
    <section
      data-section="external-action"
      // ⚠ `capability` HERE IS PROSE, NOT A CAPABILITY NAME. Two shipped fences sweep this
      // panel's HTML and this file's source for the three capability IDS; this attribute
      // names a SHAPE, and a reader checking those fences should not have to wonder.
      data-shape={shape}
      data-testid="external-action-section"
      className={SECTION_CLASSES}
    >
      <h3 id={headingId} className="text-[11px] font-medium text-foreground">
        {EXTERNAL_ACTION_HEADING}
      </h3>

      {/* ⭐ ONE QUESTION, THEN ONE QUESTION — and the second one lives inside the first's
          answer. The picker reads every connection in the org, of every shape, in one
          unscoped call; once one is bound it mounts that connection's own action list.
          NO LAYOUT CHANGE (D-211-07): the picker occupies the same slot the deleted
          radiogroups occupied, in the same section frame, with the same spacing. */}
      <ConnectionPicker />

      {/* Said ONLY when the step names no action yet — the empty/no-capability note by name
          (UI-SPEC §9d). A step with an action chosen still sends nothing unless a connection
          is bound, and that fact is carried where D-12 and D-16 put it: the canvas badge at
          design time and the run word at run time. */}
      {shape === "unset" && (
        <p data-testid="external-action-nothing-chosen" className={NOTE_CLASSES}>
          {EXTERNAL_ACTION_NOTHING_CHOSEN_NOTE}
        </p>
      )}
    </section>
  )
}

export default ExternalActionSection
