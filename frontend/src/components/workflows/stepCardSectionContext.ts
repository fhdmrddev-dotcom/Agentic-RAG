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
