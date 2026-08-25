/**
 * Phase 103-04 Task 2 (REQ-5 / WFAUTH-01, sketch 019-D D8/D9) — PhaseFormPanel.
 *
 * Phase 103-ux: the form is now PLAIN-LANGUAGE for a non-technical business user.
 * Every raw schema field name (prompt / available_tools / folder_scope / …) is
 * shown as a friendly label; the technical term stays reachable behind a small ⓘ
 * hint (a hover/focus tooltip — no heavy popover library). The per-phase-type
 * field CONDITIONING is unchanged (same fields per type); only the surface wording
 * + a few renderers (tool chips, folder/skill NAMES) changed.
 *
 * Phase 103-ux helper line: every field ALSO renders a muted, always-visible
 * one-line plain-English helper sentence directly under its label (the optional
 * `help` prop on the shared field components → FieldLabel renders it). The hover-only
 * ⓘ (which maps to the exact technical term like `prompt`/`folder_scope`) stays for
 * power users, but the plain helper needs NO hover/click — a non-technical user knows
 * what each parameter means at a glance.
 *
 * ⚠ CORRECTED at Phase 199-06 (DES-01, sheet `c4-phase-form-panel`), in the commit that
 * falsified it, and kept above rather than overwritten because it was true for six phases.
 * THE HELPER LINE IS NO LONGER ALWAYS-VISIBLE: it is the FULLY-OPEN reading of a density
 * ceiling, offered by one switch at the top of the body (`FieldGuidance.tsx`). The reason is
 * SEED-184's, measured rather than asserted — this panel printed SEVEN such sentences at
 * once on an agent step, and the label above each one already said the same thing in the
 * same words while the ⓘ beside it already carried the precise technical term. **Nothing a
 * person needs in order to DECIDE moved**: the governance state, the strict/loose door, the
 * armed-action state, the deliverable, every refusal and every per-option consequence
 * caption stay at the collapsed reading, enumerated as `FENCED_IN` in this file's suite
 * BEFORE anything moved. The ⓘ is untouched and still needs no toggle.
 *
 * The fixed-width 400px right-side form panel that REFINES one phase of a draft
 * by FORM. It is the SECOND column of the Builder's push grid (the parent owns
 * the `gridTemplateColumns` reflow) — it PUSHES the read-only spine graph, it
 * NEVER overlays it. The panel is a grid track (no absolutely-positioned overlay).
 * At rest (no node selected) it collapses to a thin 44px rail; on mobile (<768px)
 * the parent grid switches it to a bottom-sheet row (a media-query concern owned
 * by the parent; this component stays layout-neutral).
 *
 * The form is CONDITIONED on `phase.config.phase_type` and renders ONLY that
 * type's real editable fields (the 6-form map mirroring `harness.py`). The locked
 * invariants:
 *  - programmatic / llm_human_input show NO model/tools/scope (deterministic step /
 *    a human pause).
 *  - llm_emit is the ONLY type with `citation_policy` (editable) + `integrity_policy`
 *    (GREYED / read-only — declared in the schema, the emitter wiring is Phase 106).
 *  - `folder_scope` always renders the folder NAME(s) + bound UUID, NEVER a path.
 *
 * A field edit calls `onChange(patch)`; a blur/save calls `onPersist()` (the page
 * wires it to `updateWorkflowDraft` PATCH after the first `createWorkflowDraft`).
 *
 * Phase 184-09 (CANVAS-04 / R11, sketch 140-A): the panel is now ALSO the canvas's step
 * inspector — a third way IN to this one form, never a second form. Governance arrives as
 * three RAILS on the optional `rails` prop: locked order, a tool whitelist sourced live
 * from `GET /workflows/grounding-bundle`, and the checks that cannot be detached. The prop
 * is optional for a load-bearing reason: this component is rendered ONCE, by the page, and
 * serves BOTH the shipped Spine view and the flagged Canvas view, so `rails` ABSENT must
 * render today's panel byte-for-byte or a flag-off user's surface drifts (D-14 /
 * D-181-01). Every rail branch in this file is therefore gated on `rails` being present.
 * Phase 184 does NOT invent an authored grounding field — the gates are DERIVED by the
 * caller; Phase 185-07 mounts the governance section beside them as ONE gated line — the
 * dial, its refusal and the arming switch all live in that file, never in this one (G-5).
 *
 * THE PANEL IS DISMISSED FROM ITS OWN HEADER, and `onClose` is REQUIRED so it can
 * never mount unclosable. For one shipped revision the only exit was re-activating the
 * same node — a move a user has no way to discover — so the panel could be entered and
 * not left. Making the handler required puts that state outside the type system rather
 * than outside the tests: the parent owns the selection, this header owns the ask.
 */
import { useId } from "react"
import { ExternalActionSection } from "./ExternalActionSection"
// 199-06 (DES-01) — the density ceiling, its OWN component and one gated line, the fourth
// honouring of this file's standing G-5 order. ⚠ THE SWITCH'S STATE LIVES IN THAT MODULE
// AND NOT HERE, and that siting is a shipped fence rather than a taste: this file's suite
// asserts an ABSOLUTE ZERO of the three state/effect/memo tokens over its own source, and a
// pin relaxed to make red go green is a pin that never fails again. This file reads the
// answer; it does not hold it.
import { FieldGuidance } from "./FieldGuidance"
import { useFieldGuidance } from "./fieldGuidanceContext"
import { GovernanceSection } from "./GovernanceSection"
// 200 (the step-panel port) — the own-property reader, imported to close the ONE remaining
// live WR-04 prototype-key sink in this file (`CITATION_CAPTIONS`). See its use site.
import { own } from "./ownProperty"
import { PromptVariableChips } from "./PromptVariableChips"
// 200-04 (DES-02, §1 `SP-MR-02`/`SP-MR-03`/`SP-MR-04`) — sheet c4's card shell and the words
// it wears, split across a component and a leaf for the reason `FieldGuidance` is: a component
// file may not export shared non-component values (`react-refresh/only-export-components`;
// 27 files in this tree answer that with a leaf, and zero eslint disables exist). ⚠ THE SHELL
// HOLDS NO STATE — this file's own suite pins its hook count at an ABSOLUTE ZERO, and these
// cards frame DECISIONS (what a step can reach, what it changes outside), which SEED-184's
// rule 3 forbids folding behind a click anyway.
import { StepCardSection } from "./StepCardSection"
import {
  outsideChangeSentence,
  STEP_CARD_CHECKS_TITLE,
  STEP_CARD_DELIVERS_TITLE,
  STEP_CARD_MODEL_TITLE,
  STEP_CARD_NEEDS_ARMING,
  STEP_CARD_NO_SOURCE_ADD,
  STEP_CARD_OUTSIDE_SENTENCE,
  STEP_CARD_OUTSIDE_TITLE,
  STEP_CARD_REACH_TITLE,
  STEP_CARD_WHAT_IT_DOES_TITLE,
} from "./stepCardSectionContext"
import { TemplateAttachSection } from "./TemplateAttachSection"
import { TemplateNameCheck } from "./TemplateNameCheck"
// 196-08 (AUTH-04) — the registry-backed picker. ONE import, and the arrow points ONE WAY:
// this panel imports the picker, the picker imports nothing from here.
//
// ── THE `FieldLabel` EXTRACTION: CONSIDERED, AND DEFERRED ON A REASON ──────────────────────
//
// `FieldLabel` and `InfoHint` are private functions in THIS file, so the picker renders the
// same two-audience structure locally rather than importing them. Plan 196-05 discovered that
// (its `<interfaces>` assumed the primitive was importable; it is not) and recommended that
// THIS plan extract both into their own module, because this is the file that owed the edit.
//
// ⚠ IT IS DELIBERATELY NOT TAKEN HERE, and the reason is the shape of this plan rather than
// disagreement with the recommendation. The extraction is the right architecture: it removes a
// real duplication and permanently forecloses the ESM cycle that exporting `FieldLabel` would
// otherwise invite once the import above exists. But it is a refactor of a G-5 hot file that
// would also rewrite the picker's rendered markup — a component whose 32-case suite pins that
// markup — inside the one plan whose whole discipline is a capped diff under this file's
// standing ONE GATED LINE order. Smuggling a refactor into the mount that makes AUTH-04 real
// is how a narrow change stops being reviewable as one.
//
// NO CYCLE EXISTS TODAY: the arrow points one way, and nothing here exports a label primitive.
//
// ⚠ RE-OPEN TRIGGER, concrete so this is a deferral and not a drop — take the extraction in
// the FIRST of these to happen: (a) any change to `FieldLabel`'s or `InfoHint`'s markup or
// a11y contract, which would silently desynchronise the picker's local copy; (b) a THIRD
// consumer needing the same two-audience label; or (c) any future need to import a primitive
// from this file back into the picker, which is the move that would create the real cycle.
//
// ⚠ THE TYPE IS ALIASED ON IMPORT, AND THE ALIAS IS LOAD-BEARING RATHER THAN COSMETIC. A
// generic written over the child's own props type — `Pick< the-props-type , … >` — puts the
// component's opening-tag token on a line that is NOT a mount, because the props type's name
// starts with the component's name. This phase's fence counts lines carrying that token, so an
// unaliased reference reads as a FIFTH mount with no phase-type guard, which is precisely the
// shape the fence exists to reject. Aliasing keeps "a line carrying the tag" and "a mount" the
// same set. ⚠ The token is not spelled anywhere in this file's prose for the same reason — a
// comment that describes a fence is counted BY it (the 187-24 trap; this very comment hit it).
import { ModelField, type ModelFieldProps as PickerProps } from "./ModelField"
import type { PhaseSpecJSON } from "./phaseVocabulary"
// 200-04 (DES-02, §1 `SP-MR-01`) — the tool-phrase vocabulary, its own leaf. This panel now
// spells NO tool phrase inline, and the reader it imports routes every lookup through
// `own()`: the map that used to live here read `map[id] ?? id`, which is the EIGHTH live
// WR-04 prototype-key sink in this tree, and it was observed RED against this very file (a
// chip whose label rendered as nothing at all, because React refuses a function child).
import { toolName } from "./toolNames"
// 200 (the step-panel port) — the tool CHOICE set and its one reveal, its own leaf because a
// reveal is state and this file's hook count is pinned at an ABSOLUTE ZERO. The reference
// sheet draws TWELVE pills; the server offers TWENTY-EIGHT, and the shipped set printed every
// one of them. Nothing is dropped — the unchosen remainder is one click away, and every
// CHOSEN or UNREGISTERED tool is pinned open (a decision and a finding are never folded).
import { ToolChoiceSet } from "./ToolChoiceSet"
// 200 (the step-panel port) — the sheet's CLOSING card, pinned to the bottom of the panel.
// The CLAIM about what is still missing lives in the leaf beside it, where it can be tested
// without a DOM; two rows the sketch itself draws are refused there, with reasons.
import { StepReadiness } from "./StepReadiness"
import {
  stepGaps,
  STEP_ANCHOR_FILES,
  STEP_ANCHOR_OUTSIDE,
  STEP_ANCHOR_WHAT_IT_DOES,
} from "./stepReadinessContext"
// TYPE-ONLY, and erased at build. The child declares its OWN props; this panel exports no
// props type for it, exactly as it exports none for the two sections above.
import type { TemplateNameClassification } from "./templateNameBuckets"

/** A partial config patch the form emits on each edit. */
export type PhaseConfigPatch = Record<string, unknown>

/** A simple id→name lookup (folders / skills). Missing ids fall back to the id. */
export type IdNameMap = Record<string, string>

/**
 * One row of the gates rail (Phase 184-09 / CANVAS-04, sketch 140-A).
 *
 * A DISCRIMINATED UNION, not a `locked: boolean` flag with an optional handler beside it,
 * because the two states differ in what they OWE the user. A locked gate came WITH a choice
 * above it — remove what made it apply and it goes; there is no switch, so a `🔒` row must
 * carry no removal control at all (not a disabled one: "cannot be wired around" is a
 * structural claim, and a disabled control is still a control that a later edit can
 * re-enable). An `○` row can be detached, and a row that says so while offering nothing to
 * press is the same lie in the other direction. Modelled this way, "a locked gate with a
 * remove button" and "a removable gate with no way to remove it" are both un-representable —
 * the idiom this file's own required `onClose` established.
 *
 * `onRemove` belongs to the CALLER because a gate is a `validators` entry, and this panel's
 * only write seam (`onChange`) patches `config`. The panel renders the rail; the page owns
 * the definition.
 */
export type PhaseGateRow =
  | { label: string; locked: true }
  | { label: string; locked: false; onRemove: () => void }

/**
 * The three governance rails (CANVAS-04). Every value here is DERIVED or SERVER-SOURCED by
 * the caller; the panel computes none of it and fetches none of it.
 *
 * - `order` — informational only. `phase_index` IS the order and there is no `depends_on`,
 *   so moving is allowed and rewiring is not representable. The rail carries no control.
 * - `toolOptions` — the set the author chooses FROM, straight off
 *   `GET /workflows/grounding-bundle` (`useGroundingBundle`). The literal `"degraded"`
 *   means the palette read FAILED and the surface must say so; an empty array would be
 *   byte-indistinguishable from an author who owns no tools, which is the lie R11 exists
 *   to prevent.
 * - `gates` — derived by the caller from the grounding CAUSE (`groundingCauseOf` in
 *   `phaseVocabulary.ts`): the page emits one locked `GOVERNANCE_GATE_ROW_LABEL` row when
 *   the cause is `detected` or `escalated`, and none otherwise. The row is synthesized
 *   CLIENT-side, never read off `/workflows/validate`, which returns problems and has no
 *   channel for a gate that will run (D-185-19). The pre-185 three-face derivation off
 *   `citation_policy` plus a `citations_required` validator is gone (SPEC Req 6).
 * - `kbTools` — the SERVER's knowledge-base tool names (D-185-09), read off
 *   `useGroundingBundle`. Absent or empty marks NOTHING, which is the safe direction: the
 *   run-time gate is server-side and unconditional, so a failed palette read can only cost
 *   a mark, never un-govern a step. Plan 185-08 supplies it from the page.
 */
export interface PhaseFormRails {
  order: { index: number; total: number }
  toolOptions: string[] | "degraded"
  gates: PhaseGateRow[]
  kbTools?: readonly string[]
}

export interface PhaseFormPanelProps {
  /** The selected phase to edit, or null at rest. */
  phase: PhaseSpecJSON | null
  /** Whether the panel is open (the form) or collapsed to the resting rail. */
  open: boolean
  /** The bound project-folder display name for `folder_scope` (name, never a path).
   *  Kept for backward-compat; `folderNames` (the id→name map) is preferred. */
  folderName?: string
  /** Phase 103-ux: id→name map so every folder_scope id renders as its real NAME
   *  (📁 Name) with the bound id reachable via the ⓘ hint. */
  folderNames?: IdNameMap
  /** Phase 103-ux: id→name map so a skill_ref id renders as its real skill NAME. */
  skillNames?: IdNameMap
  /** A field edit — the parent merges the patch into the draft definition. */
  onChange: (patch: PhaseConfigPatch) => void
  /** A blur/save — the parent persists via PATCH (after the first create). */
  onPersist: () => void
  /** Dismiss the panel; the parent owns the selection state. REQUIRED — not optional
   *  — so "a panel the user cannot close" is not a representable state and a dropped
   *  wiring is a typecheck error rather than a silent UX regression. */
  onClose: () => void
  /** Phase 184-09 (CANVAS-04 / R11, sketch 140-A): the governance rails — locked order,
   *  the server-sourced tool whitelist, and the gates that cannot be wired around.
   *
   *  ABSENT ⇒ THIS PANEL RENDERS EXACTLY AS IT DOES TODAY, BYTE-FOR-BYTE. That is not a
   *  nicety, it is the D-14 / D-181-01 mechanism: `PhaseFormPanel` is ONE instance serving
   *  BOTH the shipped Spine view and the flagged Canvas view, so any change to its rendered
   *  controls would change what a flag-off user sees — including an operator. Riding the
   *  rails on an optional prop makes the flag-off surface identical by construction rather
   *  than by review. `revertByteIdentical.test.tsx` never renders this component, so the
   *  guard lives in `PhaseFormPanel.rails.test.tsx` instead. */
  rails?: PhaseFormRails
  /** D-185-10 — the PhaseSpec-level governance write. Caller-owned for the same reason
   *  `PhaseGateRow.onRemove` is: these fields are siblings of `validators`, and this panel's
   *  only write seam (`onChange`) patches `config`. ABSENT ⇒ the section renders READ-ONLY
   *  rather than disappearing, so a dropped wiring is visible on screen, not silent. */
  onGovernanceChange?: (patch: { grounding_escalated?: boolean; action_risk_armed?: boolean }) => void
  /**
   * Phase 193 (AUTH-03) — the DEFINITION-level template binding for the deliverable step.
   *
   * Caller-owned for the third time in this file's history and for the same reason
   * `PhaseGateRow.onRemove` and `onGovernanceChange` are: the descriptor is a sibling of
   * `phases` in `definition.assets[]`, and this panel's only write seam (`onChange`) patches
   * `config`. Routing it through `onChange` would bury a definition-level fact inside one
   * step's config, where the run engine's `resolve_template_source` would never look for it.
   *
   * ABSENT ⇒ NOTHING RENDERS, which keeps every existing mount of this panel — including the
   * flag-off Spine surface — exactly as it is. The control itself, its upload, its refusals
   * and every sentence it says live in `TemplateAttachSection.tsx`, per the standing G-5
   * order on this file: the next surface that needs the panel gets its own component and one
   * gated line.
   */
  template?: {
    /** The saved draft's row id, or `null` when the draft has never been saved. */
    definitionId: string | null
    /** The attached template's filename, resolved by the caller off `definition.assets[]`. */
    filename?: string
    assetId?: string  // its `asset_id`, from the SAME descriptor as `filename` (260814-q5r)
    /** The returned descriptor, handed up — the caller appends and saves. */
    onAttached: (asset: { kind: "template"; asset_id: string; filename: string; mime: string }) => void
  }
  /**
   * Phase 193.1 (AUTH-03 / SC#3) — which of the attached template's fields the draft's own
   * steps NAME, already classified by the caller.
   *
   * Caller-owned for the FOURTH time in this file's history and for the identical reason the
   * three props above are: the answer is derived from `definition.inputs[]` and the phase
   * slugs — siblings of `phases` — while this panel's only write seam patches `config`. The
   * panel therefore COMPUTES NOTHING here: it receives a finished answer and forwards it.
   *
   * ABSENT ⇒ NOTHING RENDERS, which is what keeps every other mount of this panel — including
   * the flag-off Spine surface — byte-identical by construction rather than by review.
   *
   * ⚠ ONE GATED LINE, BY STANDING ORDER (G-5 / D-22). This file measures 15 commits across 7
   * phases and 1136 lines, so G-5 fires on it, and its hot-file ledger row closes with an
   * instruction rather than a status: *"the next surface that needs the panel gets its own
   * component and one gated line."* Phase 185 honoured it, Phase 193 honoured it again at the
   * mount below, and this is the third. A name check written inline here would turn an
   * honoured guardrail into a violated one. **No override is recorded for Phase 193.1.**
   */
  nameCheck?: {
    classification: TemplateNameClassification
  }
  /**
   * Phase 196-08 (AUTH-04 / D-20) — the live model registry answer, already finished.
   *
   * Caller-owned for the FIFTH time in this file's history and for the identical reason the
   * four props above are: the answer is derived ABOVE this panel — one `GET /models/registry`
   * read plus the app-wide ⌥ reveal — while this panel's only write seam (`onChange`) patches
   * `config`. The picker mounts FOUR times in one open, so a component-level fetch would be
   * four requests per step click; owning the read at `WorkflowBuilderPage` is what makes the
   * one-gated-line shape below satisfiable at all.
   *
   * THE PANEL COMPUTES NOTHING FOR IT — no memo to shape the rows, no predicate to drop the
   * disabled ones, no projection to build the options. Every one of those lives in the picker
   * component and its vocabulary module. This panel receives a finished answer and forwards it
   * whole. (⚠ The hook names are deliberately not spelled: the fence below counts them over
   * this file's own source, so naming them in prose is how a guardrail fails by description.)
   *
   * ABSENT ⇒ THE FOUR MOUNTS RENDER NOTHING, which is what keeps every other mount of this
   * panel byte-identical by construction rather than by review. ⚠ Unlike the four props above,
   * absence here REMOVES a field that has been on this form since Phase 103 rather than
   * withholding a new section — a deliberate trade the caller documents at its own mount: an
   * absent field writes nothing and says nothing false, while a picker fed an empty array
   * would label every stored model "not in the registry". Absence must never resurrect the
   * free-text box; that is fenced in `PhaseFormPanel.test.tsx`.
   *
   * ⚠ ONE GATED LINE, BY STANDING ORDER (G-5 / D-22 / D-20). This file's hot-file ledger row
   * closes with an instruction rather than a status: *"the next surface that needs the panel
   * gets its own component and one gated line."* Phase 185 honoured it, Phase 193 honoured it
   * again, Phase 193.1 made it MECHANICAL with a `?raw` source fence — and this phase is the
   * FOURTH honouring. It writes its OWN fence, because the shipped one is scoped to the
   * template name-check mount and a picker mount passes through it invisibly.
   *
   * ⚠ THE TOKEN THAT MOUNT IS MATCHED BY IS DELIBERATELY NOT SPELLED IN THIS DOCBLOCK. The
   * shipped fence splits this file's own source and counts the lines carrying it, so writing
   * it in prose makes the count 2 and fails a guardrail by describing it — the 187-24 trap,
   * which this paragraph hit on its first draft. The same rule binds the picker's fence below.
   *
   * The shape is `Pick` off `ModelFieldProps` rather than a re-typed object literal, so the
   * spread at each mount matches the component's contract by construction: a prop renamed in
   * `ModelField` becomes a typecheck error here instead of a silently dropped attribute.
   */
  /**
   * ⚠ 199-06 (DES-01) — `noAnswer` IS NOW IN THE PICK, AND WITH IT THE PARAGRAPH ABOVE THAT
   * READS *"ABSENT ⇒ THE FOUR MOUNTS RENDER NOTHING"* HAS A SECOND HALF. It stays true and
   * is kept verbatim, because a caller may still withhold the prop entirely. What changed is
   * that withholding it is no longer the caller's ONLY move on a failed read: the picker can
   * now be handed the reading instead of the rows, and it says so on screen. `196-08`'s own
   * mount comment named this as a cost it was paying and named the file that owed the fix.
   *
   * The mounts are untouched — each still spreads the caller's answer WHOLE, so a widened
   * `Pick` reaches all four without a fifth line, and the source fence that counts them
   * still reads four.
   */
  modelPicker?: Pick<PickerProps, "models" | "runDefaultModel" | "showTechnical" | "noAnswer">
  /** Phase 205 (STATE-01 / D-08) — whether the workflow is in stateful / living register mode. */
  isStateful?: boolean
}

const CITATION_POLICIES = ["strict", "flag", "partial", "draft"] as const
const INTEGRITY_POLICIES = ["strict", "documented_limit"] as const
const MERGE_STRATEGIES = ["concat", "concat_numbered"] as const

/** Plain-language captions for citation_policy (sourcing strictness). */
const CITATION_CAPTIONS: Record<string, string> = {
  strict: "Every claim must be cited — the deliverable fails if anything is uncited.",
  flag: "Delivers, but marks any uncited claims so a reviewer can spot them.",
  partial: "Blanks out uncited values (leaves them empty rather than inventing them).",
  draft: "No enforcement — labels the whole thing a draft.",
}

/** Plain-language labels for each phase type (the small header chip). */
const PHASE_TYPE_FRIENDLY: Record<string, string> = {
  programmatic: "Server step",
  llm_single: "AI write step",
  llm_agent: "AI agent step",
  llm_batch_agents: "Parallel agents",
  llm_human_input: "Needs a person",
  llm_emit: "Deliverable",
  // Phase 189-14 — the SAME word the shared `PHASE_TYPE_LABELS` map uses. This map is a
  // LOCAL duplicate and it already carries one shipped divergence ("Needs a person" vs
  // the shared "Needs you"); that is a fact about the past, never a licence to invent a
  // second one.
  external_action: "External action",
}

/** A small ⓘ hint. WR-03: the guidance is exposed two honest ways — the native
 *  `title` shows a tooltip on MOUSE hover only (evergreen browsers do NOT surface
 *  `title` on keyboard focus), and the `aria-label` supplies the accessible name a
 *  screen reader announces when the tabbable span receives focus. No visual popover
 *  on keyboard focus by design (zero-dep, no popover library). */
function InfoHint({ text }: { text: string }) {
  return (
    <span
      // Phase 155 (A11Y-01): role="button" (not "img") so the focusable ⓘ hint is a
      // valid tabIndex host (jsx-a11y/no-noninteractive-tabindex). WR-03: the native
      // `title` reveals the guidance visually on MOUSE hover only; the aria-label
      // carries the same text as the accessible name announced on focus (no
      // keyboard-focus visual tooltip is claimed).
      tabIndex={0}
      role="button"
      aria-label={text}
      title={text}
      className="ml-1 inline-grid h-3.5 w-3.5 cursor-help place-items-center rounded-full border border-border text-[8px] text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
    >
      ⓘ
    </span>
  )
}

/** A friendly field label: plain text + optional grey "(qualifier)" + optional ⓘ,
 *  PLUS a one-line plain-English helper sentence underneath (`help`).
 *
 *  ⚠ 199-06 (DES-01) — THE HELPER LINE IS NO LONGER ALWAYS-VISIBLE, AND THAT SENTENCE IS
 *  CORRECTED HERE RATHER THAN DELETED because it was true from Phase 103-ux until now. It
 *  is the FULLY-OPEN reading of sheet c4's density ceiling: the label already carries the
 *  plain name and the ⓘ already carries the exact technical term, so a helper restating the
 *  label was one idea printed twice, seven times per form. The ⓘ is UNTOUCHED and still
 *  needs no toggle — what moved is the duplication, never the power-user affordance.
 *
 *  Guidance ONLY. A sentence that states what the product will or will not do is a REFUSAL,
 *  not guidance, and does not travel through this prop — see `ToolWhitelistRail` below,
 *  whose "you cannot add one by typing" is rendered outside it for exactly that reason. */
function FieldLabel({
  htmlFor,
  text,
  qualifier,
  hint,
  help,
}: {
  htmlFor?: string
  text: string
  qualifier?: string
  hint?: string
  help?: string
}) {
  // ⚠ THE HOOK IS CALLED UNCONDITIONALLY, ON ITS OWN LINE. Folding it into the `&&` below
  // reads better and is wrong: `&&` short-circuits, so a label with no `help` would skip
  // the hook and the call order would differ between two renders of the same component.
  const guidanceShown = useFieldGuidance()
  // ⚠ THE EFFECTIVE RENDER, NOT THE PROP. The label's own bottom margin used to key off
  // `help` being SUPPLIED; keying it off `help` being SHOWN is what keeps the collapsed
  // reading spaced like a label with no helper rather than like one whose helper vanished.
  const showHelp = help !== undefined && guidanceShown
  return (
    <>
      <label
        htmlFor={htmlFor}
        className={`flex items-center text-[11px] font-medium text-foreground ${showHelp ? "" : "mb-1"}`}
      >
        <span>{text}</span>
        {qualifier && <span className="ml-1 font-normal text-muted-foreground">{qualifier}</span>}
        {hint && <InfoHint text={hint} />}
      </label>
      {showHelp && (
        <p data-testid="field-help" className="mb-1 mt-0.5 text-[11px] leading-snug text-muted-foreground">
          {help}
        </p>
      )}
    </>
  )
}

/** A labeled text input wired to onChange(key) / onPersist on blur. */
function TextField(props: {
  label: string
  qualifier?: string
  hint?: string
  help?: string
  value: string
  onChange: (v: string) => void
  onPersist: () => void
  textarea?: boolean
  type?: string
  full?: boolean
  chips?: React.ReactNode
}) {
  const id = useId()
  const cls =
    "w-full rounded border border-border bg-card px-2 py-1.5 text-[12px] text-foreground focus:border-primary focus:outline-none"
  return (
    <div className={props.full ? "col-span-2" : ""}>
      <FieldLabel htmlFor={id} text={props.label} qualifier={props.qualifier} hint={props.hint} help={props.help} />
      {props.textarea ? (
        <>
          <textarea
            id={id}
            value={props.value}
            rows={3}
            onChange={(e) => props.onChange(e.target.value)}
            onBlur={props.onPersist}
            className={`${cls} resize-none`}
          />
          {props.chips}
        </>
      ) : (
        <input
          id={id}
          type={props.type ?? "text"}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          onBlur={props.onPersist}
          className={cls}
        />
      )}
    </div>
  )
}

/** A labeled select. `disabled` greys it (read-only — integrity_policy). */
function SelectField(props: {
  label: string
  qualifier?: string
  hint?: string
  help?: string
  value: string
  options: readonly string[]
  onChange: (v: string) => void
  onPersist: () => void
  disabled?: boolean
  full?: boolean
  caption?: string
}) {
  const id = useId()
  return (
    <div className={props.full ? "col-span-2" : ""}>
      <FieldLabel htmlFor={id} text={props.label} qualifier={props.qualifier} hint={props.hint} help={props.help} />
      <select
        id={id}
        value={props.value}
        disabled={props.disabled}
        onChange={(e) => props.onChange(e.target.value)}
        onBlur={props.onPersist}
        className={[
          "w-full rounded border border-border px-2 py-1.5 text-[12px] focus:border-primary focus:outline-none",
          props.disabled
            ? "cursor-not-allowed bg-muted text-muted-foreground"
            : "bg-card text-foreground",
        ].join(" ")}
      >
        {props.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {props.caption && <p className="mt-1 text-[10.5px] leading-snug text-muted-foreground">{props.caption}</p>}
    </div>
  )
}

/** A labeled READ-ONLY input (disabled) — a bound value the user can read but not
 *  edit (e.g. the emitter registry key). Carries a real <label htmlFor> so it is
 *  reachable by accessible name. */
function ReadOnlyField(props: {
  label: string
  qualifier?: string
  hint?: string
  help?: string
  value: string
  full?: boolean
}) {
  const id = useId()
  return (
    <div className={props.full ? "col-span-2" : ""}>
      <FieldLabel htmlFor={id} text={props.label} qualifier={props.qualifier} hint={props.hint} help={props.help} />
      <input
        id={id}
        value={props.value}
        disabled
        readOnly
        className="w-full cursor-not-allowed rounded border border-border bg-muted px-2 py-1.5 font-mono text-[11px] text-muted-foreground"
      />
    </div>
  )
}

/** A read-only bound value display (folder_scope names, skill name, etc.). */
function StaticField(props: {
  label: string
  qualifier?: string
  hint?: string
  help?: string
  children: React.ReactNode
  testId?: string
  full?: boolean
}) {
  return (
    <div className={props.full ? "col-span-2" : ""}>
      <FieldLabel text={props.label} qualifier={props.qualifier} hint={props.hint} help={props.help} />
      <div
        data-testid={props.testId}
        className="break-words rounded border border-border bg-muted px-2 py-1.5 text-[11px] text-foreground"
      >
        {props.children}
      </div>
    </div>
  )
}

/** Render the folder_scope as real folder NAME(s) (📁 Name), with the bound id
 *  reachable via the per-chip ⓘ/title — never a path. `folder_scope` can hold
 *  MULTIPLE ids; each renders as its own name chip.
 *
 *  ── ⚠ 200 (the step-panel port): ROWS, NOT INLINE CHIPS — AND TWO THINGS THE SHEET DRAWS
 *  THAT ARE NOT ON THE WIRE ──────────────────────────────────────────────────────────────
 *
 *  The reference sheet gives each folder its OWN full-width row (`p-3 rounded border
 *  bg-raised`, an icon, the name), which is what makes a step's reach legible at a glance
 *  instead of a run-on chip line. That is ported. Two atoms beside it are not, and refusing
 *  them is the honest direction rather than the tidy one:
 *
 *   1. **A per-folder LOCK STATE** (`Locked — only the person who locked it can release it`).
 *      `folder_scope` is a bare `string[]`. There is no lock bit, no holder, no wire field of
 *      any kind — so a lock badge here would be a fabricated fact on a governance surface,
 *      which is the highest-consequence defect this panel can ship. NOTHING renders for it.
 *   2. **An `Add a source` BUTTON.** `folder_scope` is a READ-ONLY display in this panel and
 *      no authoring control writes it — pinned by a source assertion in
 *      `WorkflowBuilderPage.header.test.tsx`, and for a recorded reason: a phase declaring
 *      `folder_scope` on a workflow with no `project_folder_id` raises a raw 422
 *      (`_folder_scope_requires_project`), which under D-186-04's hold-the-write rule would
 *      leave a permanently unsaveable draft. So the slot is ported as the STATEMENT it
 *      actually is (`STEP_CARD_NO_SOURCE_ADD`) rather than as a control that writes nothing.
 *      A dashed box that looks pressable and does nothing is the dead control SPEC Req 5
 *      forbids; a dashed box that says where sources come from keeps the information.
 */
function FolderScopeField({
  ids,
  folderNames,
  fallbackName,
}: {
  ids: string[]
  folderNames?: IdNameMap
  fallbackName?: string
}) {
  return (
    <StaticField
      label="Folders it can read"
      hint="folder_scope — the knowledge-base folders this step is allowed to search."
      help="The knowledge-base folders this step may search."
      testId="folder-scope-display"
      full
    >
      {ids.length === 0 ? (
        <span className="text-muted-foreground">📁 {fallbackName ?? "(none)"}</span>
      ) : (
        <span className="flex w-full flex-col gap-1.5">
          {ids.map((id) => {
            const name = folderNames?.[id] ?? fallbackName
            return (
              <span
                key={id}
                title={id}
                className="flex items-center gap-2 rounded border border-border bg-card px-2 py-1.5 text-foreground"
              >
                <span className="min-w-0 flex-1 truncate">📁 {name ?? id}</span>
                <span className="shrink-0 font-mono text-[8px] text-muted-foreground" title={id}>
                  ⓘ
                </span>
              </span>
            )
          })}
        </span>
      )}
    </StaticField>
  )
}

/**
 * 200 (the step-panel port) — the sheet's `Add a source` slot, as the refusal it really is.
 *
 * ⚠ NOT A `<button>`, NOT A `[role=button]`, NOT AN `<a>`. It carries the sheet's dashed
 * treatment because that is what the sheet draws in this position, and it carries no control
 * because this panel has no write seam for `folder_scope` and one is pinned closed upstream —
 * the full argument is in `FolderScopeField`'s docblock and in `STEP_CARD_NO_SOURCE_ADD`.
 *
 * ⚠ IT IS A REFUSAL, SO IT IS NEVER FOLDED (SEED-184 rule 3) — a person meets it at rest,
 * exactly as the tool whitelist's `you cannot add one by typing` does two rows down. It does
 * NOT travel through the guidance channel; the two were sorted apart at 199-06 and this is
 * the same sort, one atom later.
 */
/**
 * 200 (the step-panel port) — the sheet's own `<hr class="border-t border-line w-full">`.
 *
 * It sits INSIDE the `What it can reach` card, between the folders and the tools, because the
 * sheet composes those two as ONE card with two halves rather than as two cards. What a step
 * can READ and what a step can DO are the same question asked twice, and the divider is what
 * says so without a second heading.
 */
function CardDivider() {
  return <hr aria-hidden="true" className="col-span-2 border-t border-border" />
}

function NoSourceAddLine() {
  return (
    <p
      data-testid="no-source-add"
      className="col-span-2 rounded border border-dashed border-border px-2 py-1.5 text-[10.5px] leading-snug text-muted-foreground"
    >
      {STEP_CARD_NO_SOURCE_ADD}
    </p>
  )
}

/**
 * 200-04 (§1 `SP-MR-04`) — the ONE line stating what this step will actually change outside
 * the run, resolved from the capability the author chose.
 *
 * ⚠ NOTHING RENDERS WHEN NOTHING IS CHOSEN, and that is the honest direction rather than the
 * tidy one. `outsideChangeSentence` returns `undefined` for a capability the closed set does
 * not carry — including the empty string a fresh step holds — and this renders nothing at
 * all, never a placeholder. A card that printed a blank consequence row would be
 * byte-indistinguishable from one whose lookup failed, and on a governance surface those two
 * readings are opposite.
 *
 * ⚠ NO ID REACHES THE DOM. The author reads a sentence; the capability name is a wire value.
 * `PhaseFormPanel.rails.test.tsx` asserts no capability NAME appears anywhere in this panel,
 * over the DEGRADED read too, because the strike-through hazard 189-04 closed was exactly a
 * capability painted as an author-facing chip.
 */
function OutsideChangeLine({ capability }: { capability: string }) {
  const sentence = outsideChangeSentence(capability)
  if (sentence === undefined) return null
  return (
    <p data-testid="outside-change" className="col-span-2 text-[11px] leading-snug text-foreground">
      {sentence}
    </p>
  )
}

/** Render available_tools as friendly chips (the raw tool ids reachable via ⓘ).
 *  Editing stays a comma field below the chips (so the field is still editable +
 *  testable via the label), and the chips are a read-friendly preview above it.
 *
 *  Phase 184-09: `options` is the CANVAS-04 whitelist rail. `undefined` — the only value a
 *  flag-off render can produce, because it is `rails?.toolOptions` — keeps the free-text
 *  comma field below byte-for-byte. Anything else replaces it with a set the author chooses
 *  FROM, and R11 forbids a free-text box in that variant: a box a user can type any string
 *  into is not a whitelist, it is a suggestion. */
function ToolsField({
  tools,
  options,
  onChange,
  onPersist,
}: {
  tools: string[]
  options?: string[] | "degraded"
  onChange: (v: string) => void
  onPersist: () => void
}) {
  const id = useId()
  if (options !== undefined) {
    return <ToolWhitelistRail tools={tools} options={options} onChange={onChange} onPersist={onPersist} />
  }
  return (
    <div className="col-span-2">
      <FieldLabel
        htmlFor={id}
        text="What this step can do"
        hint="available_tools — the tools the AI may use in this step (e.g. search_documents, execute_code)."
        help="The tools the AI may use here."
      />
      {tools.length > 0 && (
        <div data-testid="tools-chips" className="mb-1.5 flex flex-wrap gap-1.5">
          {tools.map((t) => (
            <span
              key={t}
              title={t}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[10.5px] text-foreground"
            >
              {toolName(t)}
              <span className="font-mono text-[8px] text-muted-foreground" title={t}>
                ⓘ
              </span>
            </span>
          ))}
        </div>
      )}
      <input
        id={id}
        type="text"
        value={tools.join(", ")}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onPersist}
        placeholder="search_documents, execute_code"
        className="w-full rounded border border-border bg-card px-2 py-1.5 text-[12px] text-foreground focus:border-primary focus:outline-none"
      />
    </div>
  )
}

/**
 * 199-06 (DES-01) — the whitelist's REFUSAL, hoisted to module scope so the sentence has one
 * home rather than being an attribute value. It is deliberately NOT in `definitionOps`: that
 * module is the home for the GOVERNANCE vocabulary, which is a lock, and adding an unrelated
 * form sentence to a locked vocabulary is how a lock stops meaning anything. The literal is
 * byte-identical to the one this file has rendered since Phase 184-09.
 */
const TOOL_WHITELIST_NO_TYPING =
  "Pick from the tools this workspace allows — you cannot add one by typing."

/**
 * The tool-whitelist rail (140-A) — a set the author chooses FROM, and nothing to type into.
 *
 * THE OPTION SET IS THE SERVER'S. It arrives as `rails.toolOptions`, which `useGroundingBundle`
 * fills from `GET /workflows/grounding-bundle` and from nothing else. There is no frontend
 * list of tool ids here or anywhere upstream of here — a client-assembled whitelist would let
 * knowledge-base content whitelist itself, which is the elevation of privilege the
 * server-owned registry exists to prevent. `toolNames.ts` still LABELS the chips; a
 * display-label map is not an options source and the two must not be confused — and after
 * 200-04 that distinction is structural rather than a comment: the phrase table lives in its
 * own leaf, is read through `own()`, and an id it has no phrase for prints as itself.
 *
 * A TOOL THE DEFINITION NAMES THAT THE REGISTRY DOES NOT HAVE IS SHOWN, STRUCK THROUGH — never
 * dropped. The server already answers `unregistered_tool` for it, and hiding it here would put
 * the finding somewhere the author cannot act on it while quietly editing their stored value
 * out of sight. Struck through and still pressable is the fixable form.
 *
 * A DEGRADED READ SAYS SO. `"degraded"` renders a plain sentence and ZERO options, because an
 * empty-but-normal picker is byte-indistinguishable from a registry that genuinely offers
 * nothing — it would tell the user "there are no tools" when the truth is "we could not ask".
 * What the step already names is still printed, so a failed read never looks like a wipe.
 */
function ToolWhitelistRail({
  tools,
  options,
  onChange,
  onPersist,
}: {
  tools: string[]
  options: string[] | "degraded"
  onChange: (v: string) => void
  onPersist: () => void
}) {
  // The comma string is the shipped call-site contract (`v.split(",")`), so a click commits
  // through exactly the same seam a keystroke used to — one parser, not two.
  const commit = (next: string[]) => {
    onChange(next.join(", "))
    onPersist()
  }

  return (
    <div className="col-span-2">
      <FieldLabel
        text="What this step can do"
        hint="available_tools — the tools the AI may use in this step (e.g. search_documents, execute_code)."
      />
      {/* ⚠ 199-06 (DES-01) — THIS SENTENCE LEFT THE GUIDANCE CHANNEL AND IS NOW ALWAYS ON
          SCREEN. It was the `help` prop above and it was the ONE helper in this panel that
          is not a restatement of its own label: it states that the control REFUSES typed
          input. A refusal folded behind a disclosure is a refusal a person meets by being
          surprised, so it is fenced in (SEED-184 rule 3). The literal is unchanged — it
          moved four lines, it was not re-spelled. */}
      <p data-testid="tools-no-typing" className="mb-1 mt-0.5 text-[11px] leading-snug text-muted-foreground">
        {TOOL_WHITELIST_NO_TYPING}
      </p>
      {options === "degraded" ? (
        <div data-rail="tools" data-testid="tools-degraded">
          <p className="text-[11px] leading-snug text-muted-foreground">
            We couldn&rsquo;t load the tools this step is allowed to use. Nothing is offered here
            rather than a list that would be wrong.
          </p>
          {tools.length > 0 && (
            <p data-testid="tools-degraded-current" className="mt-1 text-[11px] leading-snug text-muted-foreground">
              This step currently names: {tools.map((t) => toolName(t)).join(", ")}.
            </p>
          )}
        </div>
      ) : (
        // 200 (the step-panel port) — the chip set moved to `ToolChoiceSet.tsx`, and the move
        // is what the reveal cost. The set itself is unchanged: same ids, same order, same
        // `data-tool` / `data-unregistered` attributes, same comma seam. What it gained is a
        // readable first reading, because twenty-eight pills is the "dense form" half of the
        // operator's verdict on this panel and the two CHOSEN tools were lost inside it.
        <ToolChoiceSet tools={tools} options={options} commit={commit} />
      )}
    </div>
  )
}

/**
 * The order rail (140-A) — informational, and deliberately control-free.
 *
 * `phase_index` IS the order: there is no `depends_on`, and branching is not representable
 * in the definition at all. Moving a step is allowed (on the canvas, where the steps are);
 * rewiring one is not a thing this product can express, so the rail states the rule rather
 * than offering a switch that would have to be refused.
 */
function OrderRail({ index, total }: { index: number; total: number }) {
  return (
    // 200 (the step-panel port) — the sheet's card shape: a small-caps outside label over an
    // inset panel DARKER than the aside around it. The shipped `bg-muted/40` strip read as a
    // heading with a tint, which is the "three headings and a dense form" the operator saw.
    <section data-rail="order" data-testid="rail-order" className="mb-3 flex flex-col gap-1.5">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Order is locked</h3>
      <p className="rounded border border-border bg-background p-3 text-[11px] leading-snug text-muted-foreground">
        Runs as step {index} of {total} — steps run in order, one after another.
      </p>
    </section>
  )
}

/**
 * The gates rail (140-A) — 🔒 rows that cannot be detached beside `○` rows that can.
 *
 * A locked row's subtree contains NO `button`, no `[role="button"]` and no `input`. Not a
 * disabled one — none. That is what makes "governance you cannot wire around" a structural
 * property rather than a styling choice, and it is why the ⓘ `InfoHint` (which is
 * `role="button"` for a11y reasons) is deliberately not used inside a row.
 *
 * The glyph is `aria-hidden` and the meaning is carried by a real visible WORD on both
 * branches (the never-colour-alone / never-glyph-alone rule the canvas cards already
 * follow), so the distinction survives a screen-reader read and a colour-blind read alike.
 */
function GatesRail({ gates }: { gates: PhaseGateRow[] }) {
  return (
    // 200 (the step-panel port) — the sheet's card shape, as the two rails beside it now wear.
    // ⚠ THE HEADING LITERAL MOVED TO `stepCardSectionContext.ts` AND DID NOT CHANGE. It is a
    // `RAIL_MARKERS` entry in `PhaseFormPanel.rails.test.tsx`, asserted ABSENT from every
    // rails-absent render — and it still is, because the constant renders only from here.
    <section data-rail="gates" data-testid="rail-gates" className="mt-3 flex flex-col gap-1.5">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{STEP_CARD_CHECKS_TITLE}</h3>
      <div className="rounded border border-border bg-background p-3">
      {gates.length === 0 ? (
        <p className="text-[11px] leading-snug text-muted-foreground">
          No checks apply to this step yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {gates.map((gate) => (
            <li
              key={gate.label}
              data-testid="gate-row"
              data-locked={gate.locked ? "true" : "false"}
              className="flex items-center gap-1.5 text-[11px] text-foreground"
            >
              <span aria-hidden="true">{gate.locked ? "🔒" : "○"}</span>
              <span className="min-w-0 flex-1 truncate">{gate.label}</span>
              {gate.locked ? (
                <span className="shrink-0 text-[10.5px] text-muted-foreground">Cannot be removed</span>
              ) : (
                <button
                  type="button"
                  onClick={gate.onRemove}
                  className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10.5px] text-muted-foreground hover:bg-accent/40 hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1.5 text-[10.5px] leading-snug text-muted-foreground">
        A locked check came with a choice above it — change what made it apply and it goes.
        There is no switch.
      </p>
      </div>
    </section>
  )
}

function asStr(v: unknown, fallback = ""): string {
  return v == null ? fallback : String(v)
}
function asList(v: unknown): string[] {
  return Array.isArray(v) ? (v as unknown[]).map((x) => String(x)) : []
}

export function PhaseFormPanel({
  phase,
  open,
  folderName,
  folderNames,
  skillNames,
  onChange,
  onPersist,
  onClose,
  rails,
  onGovernanceChange,
  template,
  nameCheck,
  modelPicker,
  isStateful,
}: PhaseFormPanelProps) {
  // RESTING rail — the parent grid collapses this column to 44px; show a thin hint.
  if (!open || !phase) {
    return (
      <aside
        data-testid="phase-form-rail"
        aria-label="Phase form (collapsed)"
        className="flex h-full min-w-0 items-start justify-center border-l border-border bg-card pt-4"
      >
        <span className="select-none text-[10px] text-muted-foreground [writing-mode:vertical-rl]">
          select a step to refine it
        </span>
      </aside>
    )
  }

  const cfg = phase.config as Record<string, unknown>
  const pt = phase.config.phase_type
  const folderIds = Array.isArray(cfg.folder_scope) ? (cfg.folder_scope as string[]) : []
  const friendlyType = PHASE_TYPE_FRIENDLY[pt] ?? pt

  // A small helper to wire a field key → onChange patch (parent merges).
  const set = (key: string) => (v: string | number) => onChange({ [key]: v })

  // Resolve a skill_ref id → its real NAME for read-friendly display.
  const skillRefId = asStr(cfg.skill_ref)
  const skillRefName = skillRefId ? (skillNames?.[skillRefId] ?? skillRefId) : ""

  return (
    <aside
      aria-label={`Refine step: ${phase.name ?? phase.slug}`}
      className="flex h-full min-w-0 flex-col overflow-hidden border-l border-border bg-card"
    >
      {/* ⚠ PORTED FROM THE SHEET'S MARKUP (`screens/step-panel.html`), not from a checklist.
          It draws the header as a COLUMN — a bordered small-caps type badge on its own line,
          then the step's name as the heading under it — and the shipped header was a single
          row with the badge crammed between the name and the ✕. The badge-above-title order
          is what lets the name be read as a title rather than as one more chip in a strip. */}
      <header className="flex items-start justify-between gap-2 border-b border-border px-3 py-2.5">
        <div className="flex min-w-0 flex-col gap-1">
          <span
            title={pt}
            className="w-fit rounded border border-border bg-muted px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wide text-muted-foreground"
          >
            {friendlyType}
          </span>
          <h2 className="min-w-0 break-words text-[13px] font-semibold leading-snug text-foreground">
            {phase.name?.trim() || phase.slug}
          </h2>
        </div>
        {/* The discoverable exit — a normal flex child of the header, never an
            absolutely-positioned overlay (the panel is a grid track). The glyph is
            hidden from the a11y tree so the announcement is the label, not "✕". */}
        <button
          type="button"
          data-testid="phase-form-close"
          aria-label="Close step details"
          onClick={onClose}
          // Phase 184-11 (WR-09-02 / D-184-16 debt 2) — SUPPRESS THE FOCUS TRANSFER.
          // A press on this button moves focus off whatever field was focused, the field
          // fires `onBlur`, and `onBlur` is the panel's persist seam — so until this line
          // the ✕ silently PATCHed a version while Escape and a pane click did not. The
          // three dismissal paths looked interchangeable and were not. Preventing the
          // mousedown default keeps focus where it is, so no dismissal writes, on any
          // path, in a real browser as well as under a test driver. Nothing is lost: every
          // field is CONTROLLED, so the typed value reached the definition on the
          // keystroke, and the page flushes the coalescing undo entry as it releases.
          // Keyboard activation never fires `mousedown`, so Enter/Space are untouched.
          onMouseDown={(event) => event.preventDefault()}
          className="inline-grid h-6 w-6 shrink-0 place-items-center rounded text-[11px] text-muted-foreground hover:bg-accent/40 hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <p className="mb-3 text-[11px] text-muted-foreground">
          Refine this step — adjust what it does, then move on.
        </p>

        {/* 199-06 (DES-01) — THE DENSITY CEILING, and the fourth honouring of this file's
            standing G-5 order: its own component, one gated line. It wraps everything that
            renders a `FieldLabel`, and NOTHING that renders a decision — the governance
            section, the door, the armed switch, the gates and the deliverable all sit
            inside it too, but they read no guidance context and are untouched by it. */}
        <FieldGuidance>
        {/* The rails render ONLY when the caller supplies them. Absent ⇒ today's panel. */}
        {rails && <OrderRail index={rails.order.index} total={rails.order.total} />}

        {/* 200 (the step-panel port) — `gap-4` rather than `gap-3`: the sheet spaces its
            groups at `gap-8` against a `gap-3` inside each card, and that ratio is what makes
            seven cards read as seven things. The grid itself is unchanged, because the fields
            INSIDE each card still use its two columns. */}
        <div className="grid grid-cols-2 gap-8">
          {/* ── programmatic: fn + input_keys (a deterministic server step — no LLM fields) ── */}
          {pt === "programmatic" && (
            <StepCardSection
              title={STEP_CARD_WHAT_IT_DOES_TITLE}
              testId="card-what-it-does"
              anchorId={STEP_ANCHOR_WHAT_IT_DOES}
            >
              <TextField
                label="Function"
                hint="fn — a key into the server-side function registry. This step runs deterministic code, not an AI."
                help="The registered function this step runs."
                value={asStr(cfg.fn)}
                onChange={set("fn")}
                onPersist={onPersist}
                full
              />
              <TextField
                label="Inputs"
                hint="input_keys — the named values this function reads (comma-separated)."
                help="Which earlier outputs feed this function."
                qualifier="(comma-separated)"
                value={asList(cfg.input_keys).join(", ")}
                onChange={(v) => onChange({ input_keys: v.split(",").map((s) => s.trim()).filter(Boolean) })}
                onPersist={onPersist}
                full
              />
            </StepCardSection>
          )}

          {/* ── llm_single: prompt + model + temperature + folder_scope + skill_ref ── */}
          {pt === "llm_single" && (
            <>
              {/* 200 (the step-panel port) — the sheet's FIRST card. The shipped panel opened
                  straight onto a bare labelled textarea; the sheet titles it, and the title
                  is what turns a form into a reading. The step's own dials ride here too —
                  the sheet draws none of them and they are shipped fields, so they are KEPT
                  and GROUPED rather than dropped or left loose. */}
              <StepCardSection
                title={STEP_CARD_WHAT_IT_DOES_TITLE}
                testId="card-what-it-does"
                anchorId={STEP_ANCHOR_WHAT_IT_DOES}
              >
                <TextField
                  label="Instructions"
                  hint="prompt — what you're telling the AI to do in this step."
                  help="What you want the AI to do in this step."
                  value={asStr(cfg.prompt)}
                  onChange={set("prompt")}
                  onPersist={onPersist}
                  chips={
                    <PromptVariableChips
                      isStateful={isStateful}
                      onInsert={(token) => {
                        const current = asStr(cfg.prompt)
                        const next = current ? `${current} ${token}` : token
                        onChange({ prompt: next })
                        onPersist()
                      }}
                    />
                  }
                  textarea
                  full
                />
                <TextField
                  label="Creativity"
                  hint="temperature — 0 is focused and repeatable, higher is more varied."
                  help="Higher = more varied wording; lower = more focused."
                  value={asStr(cfg.temperature)}
                  onChange={set("temperature")}
                  onPersist={onPersist}
                  type="number"
                />
              </StepCardSection>
              {/* 200-04 (§1 `SP-MR-02`) — sheet c4's MODEL card. The gate is `modelPicker`
                  so an absent registry answer renders no empty card, and the mount line
                  inside is byte-identical to the shipped one: this file's own fence reads
                  the four mounts as a sorted SET of their `pt ===` guards, and a card that
                  changed one would fail it. */}
              {modelPicker && (
                <StepCardSection title={STEP_CARD_MODEL_TITLE} testId="card-model">
              {modelPicker && pt === "llm_single" && <ModelField {...modelPicker} value={asStr(cfg.model)} onChange={set("model")} onPersist={onPersist} />}
                </StepCardSection>
              )}
              <StepCardSection title={STEP_CARD_REACH_TITLE} testId="card-reach">
                <FolderScopeField ids={folderIds} folderNames={folderNames} fallbackName={folderName} />
                <NoSourceAddLine />
                <CardDivider />
                <SkillField name={skillRefName} rawId={skillRefId} onChange={set("skill_ref")} onPersist={onPersist} />
              </StepCardSection>
            </>
          )}

          {/* ── llm_agent: + available_tools + max_steps (12) + wall_clock_seconds ── */}
          {pt === "llm_agent" && (
            <>
              <StepCardSection
                title={STEP_CARD_WHAT_IT_DOES_TITLE}
                testId="card-what-it-does"
                anchorId={STEP_ANCHOR_WHAT_IT_DOES}
              >
                <TextField
                  label="Instructions"
                  hint="prompt — what you're telling the AI to do in this step."
                  help="What you want the AI to do in this step."
                  value={asStr(cfg.prompt)}
                  onChange={set("prompt")}
                  onPersist={onPersist}
                  chips={
                    <PromptVariableChips
                      isStateful={isStateful}
                      onInsert={(token) => {
                        const current = asStr(cfg.prompt)
                        const next = current ? `${current} ${token}` : token
                        onChange({ prompt: next })
                        onPersist()
                      }}
                    />
                  }
                  textarea
                  full
                />
                <TextField
                  label="Max steps"
                  hint="max_steps — how many actions the AI may take before it must stop."
                  help="How many actions the AI may take before it stops."
                  value={asStr(cfg.max_steps, "12")}
                  onChange={set("max_steps")}
                  onPersist={onPersist}
                  type="number"
                />
                <TextField
                  label="Time limit"
                  qualifier="(seconds, optional)"
                  hint="wall_clock_seconds — stop this step after this many seconds, even if it isn't finished."
                  help="Stop this step after this many seconds (optional)."
                  value={asStr(cfg.wall_clock_seconds)}
                  onChange={set("wall_clock_seconds")}
                  onPersist={onPersist}
                  type="number"
                />
              </StepCardSection>
              {modelPicker && (
                <StepCardSection title={STEP_CARD_MODEL_TITLE} testId="card-model">
              {modelPicker && pt === "llm_agent" && <ModelField {...modelPicker} value={asStr(cfg.model)} onChange={set("model")} onPersist={onPersist} />}
                </StepCardSection>
              )}
              {/* ⚠ 200 (the step-panel port) — THE TOOLS MOVED INSIDE THIS CARD, under the
                  sheet's own `<hr>`. The reference composes folders and tools as ONE card in
                  two halves; the shipped panel had the tool list floating between two
                  unrelated number fields, which is why the card titled *what it can reach*
                  read as though it were only about folders. */}
              <StepCardSection title={STEP_CARD_REACH_TITLE} testId="card-reach">
                <FolderScopeField ids={folderIds} folderNames={folderNames} fallbackName={folderName} />
                <NoSourceAddLine />
                <CardDivider />
                <ToolsField
                  tools={asList(cfg.available_tools)}
                  options={rails?.toolOptions}
                  onChange={(v) => onChange({ available_tools: v.split(",").map((s) => s.trim()).filter(Boolean) })}
                  onPersist={onPersist}
                />
                <CardDivider />
                <SkillField name={skillRefName} rawId={skillRefId} onChange={set("skill_ref")} onPersist={onPersist} />
              </StepCardSection>
            </>
          )}

          {/* ── llm_batch_agents: + max_parallel_agents (5) + merge_strategy ── */}
          {pt === "llm_batch_agents" && (
            <>
              <StepCardSection
                title={STEP_CARD_WHAT_IT_DOES_TITLE}
                testId="card-what-it-does"
                anchorId={STEP_ANCHOR_WHAT_IT_DOES}
              >
                <TextField
                  label="Instructions"
                  hint="prompt — what you're telling the AI to do for each item it works on."
                  help="What you want the AI to do in this step."
                  value={asStr(cfg.prompt)}
                  onChange={set("prompt")}
                  onPersist={onPersist}
                  chips={
                    <PromptVariableChips
                      isStateful={isStateful}
                      onInsert={(token) => {
                        const current = asStr(cfg.prompt)
                        const next = current ? `${current} ${token}` : token
                        onChange({ prompt: next })
                        onPersist()
                      }}
                    />
                  }
                  textarea
                  full
                />
                <TextField
                  label="Max steps"
                  hint="max_steps — how many actions each worker may take before it must stop."
                  help="How many actions the AI may take before it stops."
                  value={asStr(cfg.max_steps, "12")}
                  onChange={set("max_steps")}
                  onPersist={onPersist}
                  type="number"
                />
                <TextField
                  label="Parallel workers"
                  hint="max_parallel_agents — how many copies run at once (one per item, up to this many)."
                  help="How many copies run at once."
                  value={asStr(cfg.max_parallel_agents, "5")}
                  onChange={set("max_parallel_agents")}
                  onPersist={onPersist}
                  type="number"
                />
                <SelectField
                  label="How to combine results"
                  hint="merge_strategy — how each worker's output is stitched into one result."
                  help="How the parallel results are merged."
                  value={asStr(cfg.merge_strategy, "concat")}
                  options={MERGE_STRATEGIES}
                  onChange={set("merge_strategy")}
                  onPersist={onPersist}
                />
              </StepCardSection>
              {modelPicker && (
                <StepCardSection title={STEP_CARD_MODEL_TITLE} testId="card-model">
              {modelPicker && pt === "llm_batch_agents" && <ModelField {...modelPicker} value={asStr(cfg.model)} onChange={set("model")} onPersist={onPersist} />}
                </StepCardSection>
              )}
              <StepCardSection title={STEP_CARD_REACH_TITLE} testId="card-reach">
                <FolderScopeField ids={folderIds} folderNames={folderNames} fallbackName={folderName} />
                <NoSourceAddLine />
                <CardDivider />
                <ToolsField
                  tools={asList(cfg.available_tools)}
                  options={rails?.toolOptions}
                  onChange={(v) => onChange({ available_tools: v.split(",").map((s) => s.trim()).filter(Boolean) })}
                  onPersist={onPersist}
                />
              </StepCardSection>
            </>
          )}

          {/* ── llm_human_input: prompt + options + timeout_seconds (300) — a human pause ── */}
          {pt === "llm_human_input" && (
            <StepCardSection
              title={STEP_CARD_WHAT_IT_DOES_TITLE}
              testId="card-what-it-does"
              anchorId={STEP_ANCHOR_WHAT_IT_DOES}
            >
              <TextField
                label="Instructions"
                hint="prompt — what the person is asked to review or decide at this pause."
                help="What the person is asked to review or decide here."
                value={asStr(cfg.prompt)}
                onChange={set("prompt")}
                onPersist={onPersist}
                textarea
                full
              />
              <TextField
                label="Choices to offer the person"
                qualifier="(comma-separated)"
                hint="options — the buttons the person picks from (comma-separated)."
                help="The options the person picks from when this pauses."
                value={asList(cfg.options).join(", ")}
                onChange={(v) => onChange({ options: v.split(",").map((s) => s.trim()).filter(Boolean) })}
                onPersist={onPersist}
                full
              />
              <TextField
                label="Wait timeout"
                qualifier="(seconds)"
                hint="timeout_seconds — how long to wait for the person before the step times out."
                help="How long to wait for the person before giving up."
                value={asStr(cfg.timeout_seconds, "300")}
                onChange={set("timeout_seconds")}
                onPersist={onPersist}
                type="number"
              />
            </StepCardSection>
          )}

          {/* ── llm_emit: the ONLY type with citation_policy + integrity_policy (greyed) ── */}
          {pt === "llm_emit" && (
            <>
              <StepCardSection
                title={STEP_CARD_WHAT_IT_DOES_TITLE}
                testId="card-what-it-does"
                anchorId={STEP_ANCHOR_WHAT_IT_DOES}
              >
                <TextField
                  label="Instructions"
                  hint="prompt — what the AI should produce for the deliverable."
                  help="What you want the AI to do in this step."
                  value={asStr(cfg.prompt)}
                  onChange={set("prompt")}
                  onPersist={onPersist}
                  textarea
                  full
                />
              </StepCardSection>
              {/* D-12 — the fitness flag rides THIS mount and no other: on the three step
                  types above the emission tier predicts nothing about the outcome, and a
                  warning that predicts nothing trains people to ignore the ones that do. */}
              {modelPicker && (
                <StepCardSection title={STEP_CARD_MODEL_TITLE} testId="card-model">
              {modelPicker && pt === "llm_emit" && <ModelField {...modelPicker} showFitness value={asStr(cfg.model)} onChange={set("model")} onPersist={onPersist} />}
                </StepCardSection>
              )}
              <StepCardSection title={STEP_CARD_REACH_TITLE} testId="card-reach">
                <FolderScopeField ids={folderIds} folderNames={folderNames} fallbackName={folderName} />
                <NoSourceAddLine />
                <CardDivider />
                <SkillField name={skillRefName} rawId={skillRefId} onChange={set("skill_ref")} onPersist={onPersist} />
              </StepCardSection>
              {/* 200 (the step-panel port) — the deliverable's own three fields, grouped. The
                  sheet draws no card for them and they are shipped fields on the one type
                  that produces a document, so they are KEPT and titled rather than left as
                  the loose column the operator's verdict named. ⚠ NOT titled `How strictly it
                  is held` — that is the card BELOW, whose heading `GovernanceSection.tsx`
                  owns; two adjacent cards under one title is how a reader concludes a control
                  has two copies (the L-14 reading its `already-set` arm exists to prevent). */}
              <StepCardSection title={STEP_CARD_DELIVERS_TITLE} testId="card-delivers">
                <ReadOnlyField
                  label="Output type"
                  hint="emitter — how the deliverable is produced (e.g. fill a template). Read-only."
                  help="How the deliverable is produced (read-only)."
                  value={asStr(cfg.emitter, "render_template")}
                  full
                />
                <SelectField
                  label="Sourcing strictness"
                  hint="citation_policy — how strictly claims in the deliverable must be backed by sources."
                  help="How strictly the deliverable must cite its sources."
                  value={asStr(cfg.citation_policy, "strict")}
                  options={CITATION_POLICIES}
                  onChange={set("citation_policy")}
                  onPersist={onPersist}
                  full
                  // ⚠ `own()`, NOT a bracket read — a live WR-04 prototype-key sink, fixed in
                  // passing (Rule 1). `citation_policy` is arbitrary wire data, so a stored
                  // `constructor` resolved `Object.prototype.constructor` off this plain
                  // literal and handed a FUNCTION to a React child — which React does not
                  // render as text, it REFUSES outright, so the caption vanished. Measured
                  // three files away in this same phase, on a chip whose label rendered as
                  // nothing at all. `own()` returns `undefined` and nothing renders, honestly.
                  caption={own(CITATION_CAPTIONS, asStr(cfg.citation_policy, "strict"))}
                />
                {/* integrity_policy: GREYED / read-only (disabled) — schema-declared, Phase 106 wiring. */}
                <SelectField
                  label="File check"
                  qualifier="(coming in Phase 106)"
                  hint="integrity_policy — re-opens the produced file to confirm it's complete. Not wired yet."
                  help="Re-opens the produced file to confirm it's complete (coming in Phase 106)."
                  value={asStr(cfg.integrity_policy, "strict")}
                  options={INTEGRITY_POLICIES}
                  onChange={() => {}}
                  onPersist={() => {}}
                  disabled
                  full
                />
              </StepCardSection>
            </>
          )}

          {/* ── external_action: the capability picker — its OWN component, ONE gated line (189 / §7a) ── */}
          {pt === "external_action" && (
            /* 200-04 (§1 `SP-MR-04`) — sheet c4's `WHAT IT CHANGES OUTSIDE THIS WORKFLOW`
               card, composed around the shipped picker rather than replacing it.
               ⚠ THE MARK IS TRUE BY CONSTRUCTION, NOT BY A SECOND COPY OF A LIST. D-04 pins
               the action-risk switch ON and unmovable for this step type, and the ONE home
               for that decision is `ARM_PINNED_TYPES` in `GovernanceSection.tsx`. This card
               renders only on that list's sole member, and this file's suite asserts the list
               still reads exactly `["external_action"]`, so the two cannot drift silently.
               ⚠ NO CONSEQUENCE FIGURE IS COMPUTED HERE. `Will overwrite 1,200 records` is
               `SP-5` — REPORTED, never built (§5): no row count exists anywhere in this
               product, and inventing one is the fabricated business figure `199-05` refused. */
            <StepCardSection
              title={STEP_CARD_OUTSIDE_TITLE}
              testId="card-outside"
              anchorId={STEP_ANCHOR_OUTSIDE}
              mark={STEP_CARD_NEEDS_ARMING}
              note={STEP_CARD_OUTSIDE_SENTENCE}
              // 200 (the step-panel port) — the sheet's amber left edge, which it spends on
              // exactly two cards: this one and the closing checklist. Both are places a
              // person is being told something happens OUTSIDE the run.
              accent="consequence"
            >
              <OutsideChangeLine capability={asStr(cfg.capability)} />
              <ExternalActionSection key={phase.slug} capability={asStr(cfg.capability)} toolName={asStr(cfg.tool_name)} onChange={set("capability")} onChangeShape={onChange} onPersist={onPersist} />
            </StepCardSection>
          )}
        </div>

        {/* 193 (AUTH-03) — the deliverable's template, its OWN component and ONE gated line
            (the standing G-5 order on this file). Gated on `llm_emit` because that is the
            only type whose executor resolves a bound template. */}
        {/* 193.1 (AUTH-03 / SC#3 / D-22) — the name check, its OWN component and ONE gated
            line, ABOVE the attach section as sketch 167 places it. Same `llm_emit` gate for
            the same reason, and the same absent-renders-nothing rule. */}
        {nameCheck && pt === "llm_emit" && <TemplateNameCheck {...nameCheck} />}
        {/* 200 (the step-panel port) — the sheet's `Files it starts from`, in the sheet's
            POSITION. Its own words stay `The file this step fills in` (one home, in
            `TemplateAttachSection.tsx`): that sentence says what the file is FOR, which the
            sheet's does not, and re-spelling it to match a drawing would trade a truer
            sentence for a matching one. The anchor is on a wrapper so the readiness
            checklist's jump row can reach a section this file does not own. */}
        <div id={STEP_ANCHOR_FILES} className="scroll-mt-3">
          {template && pt === "llm_emit" && <TemplateAttachSection {...template} />}
        </div>
        {rails && <GovernanceSection phaseType={pt} availableTools={asList(cfg.available_tools)} kbTools={rails.kbTools ?? []}
          citationPolicy={asStr(cfg.citation_policy)} groundingEscalated={phase.grounding_escalated === true}
          actionRiskArmed={phase.action_risk_armed === true} onGovernanceChange={onGovernanceChange} />}
        {rails && <GatesRail gates={rails.gates} />}
        {/* 200 (the step-panel port) — THE SHEET'S CLOSING CARD, and the last thing on the
            panel exactly as the sheet places it (`mt-auto pt-4 border-t`). ⚠ It renders
            NOTHING when nothing is missing — never `0 things still missing`, never an "all
            set", because a zero-state congratulation claims the step is COMPLETE and the
            publish gauntlet is the surface allowed to make that claim. Which conditions may
            be called missing — and which two of the sketch's own rows are refused — is
            argued in `stepReadinessContext.ts`, where it can be tested without a DOM. */}
        <StepReadiness
          gaps={stepGaps({
            phaseType: pt,
            prompt: asStr(cfg.prompt),
            fn: asStr(cfg.fn),
            outsideSentence: outsideChangeSentence(asStr(cfg.capability)),
            toolName: asStr(cfg.tool_name),
            template,
          })}
        />
        </FieldGuidance>
      </div>
    </aside>
  )
}

/** The "Skill" field — shows the real skill NAME (id reachable via ⓘ), editable by id. */
function SkillField({
  name,
  rawId,
  onChange,
  onPersist,
}: {
  name: string
  rawId: string
  onChange: (v: string) => void
  onPersist: () => void
}) {
  const id = useId()
  return (
    <div className="col-span-2">
      <FieldLabel
        htmlFor={id}
        text="Skill"
        qualifier="(optional)"
        hint="skill_ref — a saved skill this step loads. Leave blank for none."
        help="A saved skill to load for this step (optional)."
      />
      {name && (
        <div className="mb-1.5 flex items-center gap-1 text-[11px] text-foreground" data-testid="skill-name">
          <span title={rawId}>✦ {name}</span>
        </div>
      )}
      <input
        id={id}
        type="text"
        value={rawId}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onPersist}
        placeholder="(none)"
        className="w-full rounded border border-border bg-card px-2 py-1.5 text-[12px] text-foreground focus:border-primary focus:outline-none"
      />
    </div>
  )
}

export default PhaseFormPanel
