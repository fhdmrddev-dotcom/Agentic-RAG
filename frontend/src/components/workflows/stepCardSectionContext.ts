/**
 * Phase 200-04 Task 2 (DES-02, `200-CHECKLIST.md` §1 `SP-MR-02` / `SP-MR-03` / `SP-MR-04`) —
 * THE STEP PANEL'S CARD-SECTION VOCABULARY.
 *
 * Sheet c4 groups the step form into named cards — `Model`, `What it can reach`, `What it
 * changes outside this workflow` — and the ledger row `SP-2`'s note says exactly what the
 * work is: *"modelFitness.ts, the governance dial and the readiness contract ALL already
 * exist. They were never composed into the sheet's shape."* **The sheet asks for a card
 * SHAPE, not for new capability**, so every fact these cards frame is already on screen; what
 * this module adds is the words that group them.
 *
 * ── ⚠ WHY THIS IS A LEAF AND NOT PART OF `StepCardSection.tsx` ──────────────────────────
 *
 * A component file may not export shared non-component values — `react-refresh/only-export-components`
 * says so in as many words, and Phase 199's code review measured that error appearing NEW at
 * `FieldGuidance.tsx:79`. This project's established answer is a sibling leaf module (27 files
 * carry the same header) and never an `eslint-disable`: there are **zero** suppressions of that
 * rule in the tree.
 *
 * ⚠ NAMED `stepCardSectionContext.ts`, NOT `stepCardSection.ts`. A leaf whose name differs
 * from its component sibling ONLY IN CASE is a hard TypeScript error on a case-insensitive
 * filesystem (TS1149/TS1261 — measured on this Windows box at 199-06, where `tsc` went 33 → 38
 * on the first attempt). The suffix is load-bearing, not decoration.
 *
 * ── ONE HOME PER STRING ─────────────────────────────────────────────────────────────────
 *
 * The same rule `doorVocabulary.ts`, `libraryVocabulary.ts`, `decisionsVocabulary.ts` and
 * `runVocabulary.ts` already enforce four times over. A sentence that lives inside a component
 * is a sentence nobody can test for drift.
 *
 * ⚠ AND THE CONVERSE, WHICH MATTERS MORE HERE: the strings this module does NOT own are just
 * as deliberate. The governance door's words, its refusal, the arming switch's label and what
 * arming costs all stay in `definitionOps.ts`; the three external-capability sentences stay in
 * `phaseVocabulary.EXTERNAL_CAPABILITY_SENTENCES`. Re-spelling any of them here to make a card
 * read tidily would create the second copy this idiom exists to prevent — one file further along.
 */
import { own } from "./ownProperty"
import { EXTERNAL_CAPABILITY_SENTENCES } from "./phaseVocabulary"

/** `SP-MR-02` — the card that frames the model and its fitness reading. */
export const STEP_CARD_MODEL_TITLE = "Model"

/** `SP-MR-03` — the card that frames what the step is allowed to read. */
export const STEP_CARD_REACH_TITLE = "What it can reach"

/** `SP-MR-04` — the card that frames the only kind of step that acts outside the run. */
export const STEP_CARD_OUTSIDE_TITLE = "What it changes outside this workflow"

/**
 * `SP-MR-04` — the sentence the sheet prints under that title, verbatim.
 *
 * ⚠ IT STATES A CAPABILITY, NEVER A CONSEQUENCE FIGURE. The sketch also draws
 * *"Will overwrite 1,200 records"* beside it; that is `SP-5`, and it is **REPORTED, never
 * built** (`200-CHECKLIST.md` §5): no row count is computed anywhere in this product, a
 * preflight count is a capability rather than a label, and inventing one would be the
 * fabricated business figure `199-05` refused. The fence in `PhaseFormPanel.test.tsx` asserts
 * no such figure renders.
 */
export const STEP_CARD_OUTSIDE_SENTENCE =
  "This step can change records that live outside this workflow."

/**
 * `SP-MR-04` — the mark the sheet puts on a consequence that cannot happen unasked.
 *
 * ⚠ THE FACT IT STATES IS THE STEP TYPE'S, AND THIS MODULE DOES NOT RE-DERIVE IT. `D-04`
 * pins the action-risk switch ON and unmovable for `external_action`, and the ONE home for
 * that list is `ARM_PINNED_TYPES` in `GovernanceSection.tsx` (`:141`), pinned there by its own
 * source fence. The card renders only on `external_action` — that list's sole member — so the
 * mark is true by construction, and `PhaseFormPanel.test.tsx` asserts the list still reads
 * exactly `["external_action"]` so the two cannot drift apart silently. Copying the list here
 * is what would make them able to.
 */
export const STEP_CARD_NEEDS_ARMING = "NEEDS ARMING"

/**
 * The sentence for one external capability, or `undefined` when nothing named it.
 *
 * ⚠ `own()`, never a coalesced bracket read — a plain object literal inherits `constructor`,
 * which is a function and therefore never nullish, so the fallback would not fire and a
 * function would be handed to JSX. That is the WR-04 class this phase closed its EIGHTH live
 * instance of, three files away, in this same plan.
 *
 * ⚠ ABSENCE IS `undefined`, NEVER A FALLBACK STRING. A capability the closed set does not
 * carry has no honest sentence, and inventing one — title-casing the id, say — would put a
 * phrase the product never authored on a governance surface. The caller renders nothing.
 */
export function outsideChangeSentence(capability: string): string | undefined {
  return own(EXTERNAL_CAPABILITY_SENTENCES, capability)
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// Phase 200 — THE STEP-PANEL PORT. The remaining card titles the reference sheet draws.
//
// ⚠ THESE WERE MISSING, AND THE ABSENCE IS THE WHOLE FINDING. The first pass at this panel
// derived its atoms from a change-log and shipped THREE of the sheet's SEVEN cards. The
// reference — `.planning/sketches/200-journey-interactive/screens/step-panel.html` — titles
// its groups, in order: `What it does` · `Model` · `What it can reach` · `What it changes
// outside this workflow` · `Files it starts from` · `How strictly it is held` · and a closing
// `N things still missing` checklist. Four of those had no title in this module at all, so
// the panel rendered them as a bare form and a person had no way to see the grouping.
//
// ⚠ TWO OF THE SEVEN ARE DELIBERATELY NOT DECLARED HERE, AND THE OMISSION IS THE RULE
// WORKING RATHER THAN A GAP:
//   · `How strictly it is held` — the shipped words are `How strictly this step is held`,
//     and their ONE home is `SECTION_HEADING` in `GovernanceSection.tsx`, where the `<h3>`
//     text doubles as the dial group's accessible name. A second spelling here would let a
//     heading and the group it labels drift into naming different surfaces.
//   · `Files it starts from` — the shipped words are `The file this step fills in`, whose
//     one home is `TEMPLATE_SECTION_HEADING` in `TemplateAttachSection.tsx`. That sentence
//     says what the file is FOR, which the sheet's does not; re-spelling it to match a
//     drawing would trade a truer sentence for a matching one.
// Both cards are PORTED — they wear the sheet's shell and sit in the sheet's position. What
// is not ported is a second copy of their words.
// ═══════════════════════════════════════════════════════════════════════════════════════

/** The card that frames the step's own instructions — the sheet's first group. */
export const STEP_CARD_WHAT_IT_DOES_TITLE = "What it does"

/** The card that frames the checks a step is held to. Shipped words, one home. */
export const STEP_CARD_CHECKS_TITLE = "Checks that run on this step"

/**
 * The card that frames the deliverable's own three fields — how it is produced, how strictly
 * its claims must be sourced, and the file check that re-opens the produced document.
 *
 * ⚠ THE SHEET HAS NO CARD FOR THESE AND THEY ARE NOT DROPPED — the rule is that nothing in
 * the reference may be lost, not that nothing outside it may be kept. `citation_policy`,
 * `integrity_policy` and `emitter` are shipped fields on the one step type that produces a
 * document, and leaving them loose is exactly the "dense form" the port is undoing.
 *
 * ⚠ AND IT IS DELIBERATELY **NOT** TITLED `How strictly it is held`, which is the sheet's
 * word for the card BELOW it. `GovernanceSection.tsx` owns that heading (`How strictly this
 * step is held`) and its `already-set` arm exists precisely to say that the sourcing dial one
 * scroll up owns this value — two adjacent cards claiming the same title would let a reader
 * think one control had grown a second copy, which is the L-14 failure that arm prevents.
 */
export const STEP_CARD_DELIVERS_TITLE = "What it delivers"

/**
 * The sheet's `Add a source` slot, rendered as the REFUSAL it actually is.
 *
 * ⚠ THE SHEET DRAWS A BUTTON AND THIS PRODUCT HAS NO WRITE SEAM BEHIND IT. `folder_scope` is
 * a read-only display in `PhaseFormPanel` and no authoring control writes it — pinned by a
 * source assertion in `WorkflowBuilderPage.header.test.tsx`, and for a reason recorded at
 * `WorkflowBuilderPage.tsx:2312`: a phase declaring `folder_scope` on a workflow with no
 * `project_folder_id` raises a raw 422 (`_folder_scope_requires_project`), which under
 * D-186-04's hold-the-write rule would leave a permanently unsaveable draft.
 *
 * So the atom is ported as a STATEMENT, never as a control. A dashed box that looks pressable
 * and writes nothing is the dead control SPEC Req 5 forbids; a dashed box that says where
 * sources come from keeps the sheet's information reachable without inventing a capability.
 * ⚠ It is a refusal, so it is NOT foldable (SEED-184 rule 3) — a person meets it at rest.
 */
export const STEP_CARD_NO_SOURCE_ADD =
  "Sources are not added from this panel — this step reads within the workflow's knowledge base."
