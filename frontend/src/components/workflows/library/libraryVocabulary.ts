/**
 * Phase 192-05 Task 1 (LIB-01 / LIB-02 / LIB-03 — D-03 / D-08 / D-13 / D-17) — the
 * library's WORDS.
 *
 * EVERY USER-FACING STRING ON THE LIBRARY SURFACE, IN ONE HOME. The words are LOCKED in
 * `192-CONTEXT.md` and MIRRORED here: a change is a decision taken in that document and
 * reflected here, never the other way round. That is the `runVocabulary.ts:44-48` habit,
 * and it is copied for a mechanical reason rather than a tidy one — D-08 is a WORD-CLASS
 * rule ("the search is substring matching, and the product must say so"), and a word-class
 * rule is only enforceable by a fence if the words live somewhere a fence can bind to.
 * `librarySubtree.fences.test.ts` is that fence; it sweeps the whole `library/**` subtree,
 * because copy leaks out of a vocabulary module into a `placeholder` the moment nobody is
 * looking (PATTERNS.md correction C-3).
 *
 * ⚠ EXACT-MATCH ASSERTIONS ONLY when testing this table. *Starters* is a substring of
 * nothing here, but *Still building* and *Strict* share a prefix and *Ready to run* shares
 * its first word with nothing else only by luck — a `toContain` on a fragment is the
 * vacuous fence `runVocabulary.ts:57-59` names.
 *
 * ZERO NET-NEW GLYPHS, AND FIVE OF THE SIX CHIPS CARRY NONE AT ALL
 * (`icon-convention.md` §4, via PATTERNS.md §S-9). They are word-badges: the word does the
 * work and a mark would spend visual budget the design deliberately withholds. There is NO
 * category-icon vocabulary in this product and inventing one is the exact drift §4 forbids
 * — a workflow's identity on a row is already carried by its glyph-dot PHASE SPINE, which
 * `WorkflowSoul` renders unchanged. The sixth chip's mark is READ from `TIERS.STRICT.glyph`
 * and is never typed as a literal anywhere in this subtree, which is what makes the chip
 * and the card's own tier atom provably the same mark rather than two marks that agree
 * today.
 */
import { TIERS } from "@/components/workflows/deriveTier"
import type { ChipId, Provenance } from "./libraryRow"

// ── The six chips ───────────────────────────────────────────────────────────────────

/** A chip's user-facing word, and its mark if it has one (five of six do not). */
export interface ChipWord {
  /** The label a person reads. Plain language, per the 146 LANG-01 pattern. */
  label: string
  /** `null` for a word-badge. Only *Strict* has a mark, and it is read, never typed. */
  glyph: string | null
}

/**
 * The six D-03 chip words. Three of them are the RE-HOMED shelf names — "Published"
 * became *Ready to run* and "Drafts & seeds" became *Still building* — so the taxonomy
 * survives the shelves' deletion instead of being dropped with them.
 *
 * `as const satisfies Record<ChipId, ChipWord>` is the `deriveTier.ts:57-79` table idiom:
 * a seventh chip added to `ChipId` without a word here is a typecheck error, not a chip
 * that renders blank.
 */
export const CHIP_WORDS = {
  "ready-to-run": { label: "Ready to run", glyph: null },
  yours: { label: "Yours", glyph: null },
  "still-building": { label: "Still building", glyph: null },
  starters: { label: "Starters", glyph: null },
  "makes-a-file": { label: "Makes a file", glyph: null },
  strict: { label: TIERS.STRICT.label, glyph: TIERS.STRICT.glyph },
} as const satisfies Record<ChipId, ChipWord>

/** The chips' render order — the D-03 wording order, stated once so it cannot drift. */
export const CHIP_ORDER: readonly ChipId[] = [
  "ready-to-run",
  "yours",
  "still-building",
  "starters",
  "makes-a-file",
  "strict",
]

// ── The fork verb, and the one sentence this surface spends ──────────────────────────

/**
 * ONE verb on the card face for both fork paths (D-12). The user's intent is identical —
 * *give me my own editable version of this* — and the slug/version mechanics that differ
 * behind it are ours, not theirs. The two HANDLERS stay separate; only the word is shared.
 */
export const FORK_VERB = "Make my own copy"

/**
 * D-13 — THE ONE CONSEQUENCE SENTENCE THIS SURFACE SPENDS, and it names BOTH halves:
 * what you get (a new private copy, open for editing) AND what stays true (the published
 * version stays live and unchanged). Naming only the first half reproduces the exact
 * surprise LIB-03 exists to end, so a shortened rewrite of this string is a regression
 * even though it would read fine.
 *
 * It is spent HERE and nowhere else: `Run` runs and `Open` opens, and repeating a sentence
 * on every card at 200 cards is the clutter LIB-02 exists to cure. It ships as real DOM
 * text wired by `aria-describedby` — never a `title=`, because touch has no hover (D-14).
 */
export const FORK_CONSEQUENCE =
  "Opens a new private copy you can edit. The published version stays live and unchanged."

/**
 * THE SECOND TRUE SENTENCE — the one the shipped surface could not say (192-13, gap-closure
 * round 1 on the U5 blocker).
 *
 * `FORK_CONSEQUENCE` above promises *a new private copy*. On a row the person has ALREADY
 * forked, that promise is FALSE, and the measured reason is not a rare race:
 *
 *   - `192-UAT.md` test 11 — the operator clicked the fork on a published row and **nothing
 *     happened, twice**. The wire said `409 Conflict`; the surface said nothing at all.
 *   - The next version is computed from a JSONB key that is NULL on every row, so it is
 *     effectively the constant 2, and `UNIQUE(slug, version)` is **GLOBAL** — a slug that
 *     already carries the colliding version 409s **deterministically, forever**. Not a hash
 *     clash; a permanently dead button on that row.
 *   - Measured in the live local DB on 2026-08-11 (`select slug … group by slug having
 *     count(*) > 1`): **18 slugs carry more than one version**, and **14 of the 18 are exactly
 *     this shape** — a published v1 with a draft v2 and nothing else. ⚠ The plan authorising
 *     this export said *"16 of the 18"*; re-measured here rather than inherited, it is **14**
 *     under the exact-shape predicate and **15** if a slug merely CONTAINS a published v1 and
 *     a draft v2 (that admits `pm-weekly-status-report`, which carries four versions). The 18
 *     is confirmed; the 16 is not, and is corrected rather than repeated.
 *
 * The operator's 2026-08-11 decision is to **OPEN THE EXISTING DRAFT** rather than mint the
 * next free version — so on those rows the verb creates nothing, and this is what it does.
 *
 * It names BOTH halves exactly as D-13 requires — what you get (the copy you already started,
 * opened) and what stays true (the published version is untouched) — plus the fact the person
 * needs BEFORE the click rather than after it: a copy already exists. Naming only one half
 * reproduces the surprise LIB-03 exists to end, and trading a silent failure for a quiet lie
 * would not have closed this gap.
 */
export const FORK_CONSEQUENCE_EXISTING =
  "You already have your own copy of this. Opens the copy you started. The published version stays live and unchanged."

/**
 * The page-level notice for a fork click that FAILED (consumed by `192-15`).
 *
 * The rule it closes: **a click that fails must never be silent.** Code review WR-03 recorded
 * that both fork handlers swallow their failure into `console.error` while the card's own
 * delete honours "never silent" — and it was then hit in the wild as the U5 blocker, where the
 * operator's report was *"nothing happened, even the card's still the same"*. That report was
 * **literally accurate**: the surface did nothing and reported nothing.
 *
 * BOTH branches assert the same load-bearing fact — **nothing was written**. That is deliberate
 * rather than reassuring filler: the person has just been told their click failed, and a
 * message that leaves *did it half-happen?* ambiguous is barely better than no message. The
 * conflict branch additionally says WHY, in the user's own terms (a version already exists),
 * because that is the state the 409 actually describes.
 *
 * It names only the workflow's display name and that nothing was written — no status code, no
 * server prose, no ids (T-192-34). The raw error stays in `console.error` at the boundary, the
 * `WorkflowDraftUnreadableError` precedent.
 *
 * Shaped as a FUNCTION for `sourceFailedMessage`'s reason: the interpolated half is data, and a
 * template assembled at the call site is a string that leaks out of this module's fences.
 */
export function forkFailedMessage(name: string, conflict: boolean): string {
  return conflict
    ? `A version of “${name}” already exists, so a copy could not be made. Nothing was changed.`
    : `We couldn't make your copy of “${name}”. Nothing was created and nothing was changed.`
}

// ── Search (D-06 always-on, D-07 scope, D-08 word class) ─────────────────────────────

/** The always-on field's accessible label (D-06: a control you always open is always open). */
export const SEARCH_LABEL = "Search workflows"

/**
 * The placeholder. It states the SCOPE (D-07: the name and the purpose sentence) in plain
 * words and promises nothing beyond letter-for-letter matching (D-08).
 */
export const SEARCH_PLACEHOLDER = "Search by name or purpose"

/**
 * The honest one-line description of what the field does. D-08 is the reason it exists:
 * the field matches the letters you type and nothing cleverer, and the product says so
 * rather than letting a hopeful reader assume otherwise. The paraphrase *"the thing that
 * checks vendors"* returns zero rows, and this line is what makes that unsurprising.
 */
export const SEARCH_HINT = "Matches the letters you type, in the name or the purpose."

/** The one-click escape from a filtered-to-empty list (sketch 158 behaviour). */
export const CLEAR_FILTERS_LABEL = "Clear search & filters"

// ── The project filter (D-05 instrument, D-17 the fact it states) ────────────────────

/** The project select's accessible label. */
export const PROJECT_LABEL = "Project"

/** The "no project" option — the shipped `UNBOUND` sentinel's user-facing word. */
export const PROJECT_UNBOUND_LABEL = "Unbound (no project)"

/**
 * D-17 — THE TOOLBAR SAYS THAT STARTERS ARE HELD OUT OF THE PROJECT FILTER. A starter
 * genuinely carries no project (`094_starter_workflows.sql` sets none on any of the three
 * seeded rows), so this states a property of the data rather than apologising for a gap in
 * the filter. **Silence here is a UAT failure (row U6), not a neutral default**: without
 * it, starters staying on screen under a selected project reads as a broken filter.
 */
export const PROJECT_STARTERS_NOTE = "Starters aren't tied to a project."

// ── The four honest states (WorkflowSoul's D-03 rule: never hidden, never fabricated) ─

/**
 * The four states, HELD APART. *There are none* and *we could not ask* are DIFFERENT
 * FACTS — the shipped `DescribeKbPicker` / `StarterTemplatePicker` rule — and a count of
 * zero rendered during a load is a lie, so `loading` carries no number at all.
 */
export type LibraryStateId = "loading" | "empty" | "filtered-empty" | "source-failed"

export const LIBRARY_STATES = {
  loading: "Loading your workflows…",
  empty: "You have no workflows yet.",
  "filtered-empty": "No workflows match your search and filters.",
  "source-failed": "Some workflows could not be loaded, so this list is incomplete.",
} as const satisfies Record<LibraryStateId, string>

/**
 * The user-facing word for each feed, so a failed source can be NAMED rather than folded
 * into one page-wide error. Never present a partial library as a complete one.
 */
export const PROVENANCE_WORDS = {
  starter: "starters",
  published: "your published workflows",
  draft: "your drafts",
} as const satisfies Record<Provenance, string>

/** "We couldn't load «your drafts». Everything else is shown below." */
export function sourceFailedMessage(provenance: Provenance): string {
  return `We couldn't load ${PROVENANCE_WORDS[provenance]}. Everything else is shown below.`
}

// ══════════════════════════════════════════════════════════════════════════════════════
// Phase 192.1 (LIB-05) — THE IDENTITY LINE'S VOCABULARY (D-03 / D-06 / D-14 / D-18)
// ══════════════════════════════════════════════════════════════════════════════════════

/**
 * PORTED FROM THE GENERATED BUILD CONTRACT, NOT TRANSCRIBED FROM PROSE.
 *
 * The source is `.planning/sketches/163-the-assembled-card/BUILD-CONTRACT.generated.md`
 * § "Exact strings" — a file emitted by `drive.cjs --emit` FROM THE RUNNING MOCKUP, so the
 * strings below are the ones a human approved on screen rather than a re-typing of a README.
 * The sketch's own `COPY` object (`163/index.html:227-258`) was deliberately shaped to mirror
 * THIS module, which is what makes the port a copy rather than an interpretation.
 *
 * ⚠ THAT IS THE WHOLE ANTI-DRIFT MECHANISM, AND IT ONLY WORKS IF EVERY CONSUMER IMPORTS.
 * D-14: a copy change must be a ONE-LINE DIFF IN ONE FILE. A resolver or a card that spells
 * `"Copy of "` inline has silently forked the acceptance bar, and nothing typechecks prose.
 *
 * ⚠ THE TRAILING AND LEADING SPACES ARE LOAD-BEARING and are ported verbatim:
 * `LINEAGE_COPY_OF` ends with one, `LINEAGE_STARTER_SUF` begins with one, and
 * `CHANGED_PREFIX` ends with one. They are the concatenation joints the contract's rendered
 * lines were measured with (`Copy of Compliance Gap Report starter`), so trimming one and
 * "fixing" it at the call site reproduces the drift this table exists to prevent.
 *
 * ⚠ THE FIVE CARD LABELS IN THE SAME CONTRACT TABLE ARE DELIBERATELY NOT HERE.
 * `RUN_LABEL`, `OPEN_LABEL`, `DELETE_WORKFLOW`, `DELETE_DRAFT` and `MENU_ARIA` already live
 * module-private in `WorkflowCard.tsx:105-109`, where their re-home debt is recorded. Porting
 * them would create a SECOND home for five strings — the exact failure this module exists to
 * prevent — so they stay where they are, and no sixth escapee joins them.
 */

/** The owner pill, "yours" side (D-09). Read by the identity line, never by a chip. */
export const OWN_YOURS: (typeof CHIP_WORDS)["yours"]["label"] = "Yours"

/**
 * The owner pill, "not yours" side (D-09). The line stops here: **no owner display name
 * anywhere in this subtree** — the wire carries `is_mine` (a boolean) and `created_by` (a
 * uuid that is never serialized), so a person's name would need a users join nobody asked
 * for, and rendering one would be a claim the payload cannot support.
 */
export const OWN_SHARED = "Shared"

/**
 * Lineage state 1 of 3 — the row's slug is not a fork shape at all (D-13).
 *
 * ⚠ THERE IS NO CONSTANT FOR STATE 3, AND ITS ABSENCE IS THE DECISION. D-13's third state
 * is SILENCE: a slug that matches `^(.*)-[a-z0-9]{6}$` whose parent is NOT in the merged list
 * renders no lineage segment at all. Measured on the live local DB 2026-08-12 — 69 slugs match
 * the copy shape, 57 resolve, **12 are false positives** (`report` and `101uat` are both legal
 * six-character hashes) — so labelling those 12 `Original` would fabricate a fact about a
 * genuine copy whose parent was deleted or is invisible to this reader. 57 resolve · 12 go
 * quiet · 0 lie. The sketch's `lineagePhrase` returns `Original` there; on real data that is
 * wrong, and this is the one place the port deliberately does NOT follow the mockup.
 */
export const LINEAGE_ORIGINAL = "Original"

/** Lineage state 2a — a copy fork. ⚠ THE TRAILING SPACE IS PART OF THE STRING. */
export const LINEAGE_COPY_OF = "Copy of "

/** Suffixed onto a copy-fork phrase when the parent is a starter. ⚠ LEADING SPACE. */
export const LINEAGE_STARTER_SUF = " starter"

/**
 * The state segment for a row that can be run. Byte-equal to the *Ready to run* chip, and
 * that agreement is DELIBERATE — the chip and the segment name the same fact, so two
 * different words for it would be the drift `runVocabulary.ts:44-48` forbids.
 *
 * ⚠ THE TYPE ANNOTATION IS THE FENCE, and it costs nothing at runtime: `CHIP_WORDS` is
 * `as const`, so its label type is the literal itself and a rename on either side becomes a
 * TYPECHECK ERROR rather than two words that quietly disagree. The literal is still spelled
 * out because the build contract declares it as its own key — this pins the agreement without
 * making the identity line's vocabulary a derivative of the chip table's.
 */
export const STATE_RUNNABLE: (typeof CHIP_WORDS)["ready-to-run"]["label"] = "Ready to run"

/** The state segment for a draft. Same agreement, same fence, as `STATE_RUNNABLE`. */
export const STATE_DRAFT: (typeof CHIP_WORDS)["still-building"]["label"] = "Still building"

/**
 * The state segment for a starter. ⚠ NOT the *Starters* chip's word — the chip labels a
 * FILTER ("show me the starters") and this labels a ROW's state ("this row is a shared
 * starter"), so they differ on purpose and carry no agreement fence.
 */
export const STATE_STARTER = "Shared starter"

/** The project segment when a row carries no `project_folder_id` (D-17: starters never do). */
export const NO_PROJECT = "No project"

// ══════════════════════════════════════════════════════════════════════════════════════
// Phase 193-02 (AUTH-03) — THE TEMPLATE WORDS (D-13 / D-18 / D-21)
// ══════════════════════════════════════════════════════════════════════════════════════
//
// PORTED FROM THE GENERATED BUILD CONTRACT, NOT TRANSCRIBED FROM PROSE — the same
// mechanism the identity-line block above states, retargeted from sketch 163 to
// `.planning/sketches/164-telling-the-doors-apart/BUILD-CONTRACT.generated.md`
// § "AUTH-03 — the template proposal", rows `card.templateMark` and `run.templateLabel`.
// Both were read out of that table and compared byte-for-byte, not typed from memory. As
// with every string here, a copy change is a ONE-LINE DIFF IN ONE FILE.
//
// ⚠ WHY THEY LIVE HERE AND NOT IN `doorVocabulary.ts`. The two doors get their own
// vocabulary module in this same phase, and it would be an easy mistake to file these
// beside it because they arrive in the same sketch. They are LIBRARY strings: both render
// inside the fence-swept `library/` subtree — the mark on `library/WorkflowCard.tsx`'s
// identity line, the label on `library/RunModal.tsx` — and this module is that subtree's
// one home. (D-11's "all 21 ids" governs the DOORS copy table only.) A second home for a
// string is the exact failure this module exists to prevent.
//
// No consumer is added here; `193-06` and `193-07` import them.

/**
 * AUTH-03's card mark — the segment that tells a person, on the row, that this workflow is
 * one they can hand a template to. Rendered ONLY on a positive `templateAdmission(def) ===
 * "admits"` (D-15/D-21); silence otherwise, and the silence is deliberately the same for
 * *does not* and *we do not know*.
 *
 * ⚠ D-13 — IT IS A PLAIN TEXT SEGMENT. No chip, no badge, no new colour, no new component;
 * it joins the identity line muted, separated by the `·` the line already uses:
 *
 *     Yours · needs a template · changed 2 months ago
 *
 * ⚠ AND THE REASON IS CORRECTED HERE RATHER THAN REPEATED. D-13's own text justifies the
 * plain-text ruling by citing the 188.2 two-badge ceiling and its `@ts-expect-error`
 * control. Measured, that control guards the CANVAS `PhaseNodeCard`, a different component
 * — **there is no badge ceiling of any kind under `library/`, and no plan may claim a
 * typecheck enforces this one.** The ruling STANDS on the reason that actually applies:
 * SEED-155 / UAT U8, where sketch 163 drew a chip treatment this card structurally could
 * not render. A bordered chip here would repeat U8 exactly. An icon-only mark was rejected
 * too — an unlabelled glyph is the same discoverability failure AUTH-03 exists to fix.
 *
 * Slot (D-14): after provenance, before recency — *whose it is · what it needs · when it
 * changed*. It is declared here in the identity-line block and ahead of `CHANGED_PREFIX`
 * (`:383`) for that reason; `RUN_TEMPLATE_LABEL` (`:376`) sits between them because both
 * template words arrived in one wave. ⚠ Corrected on measurement (193 REVIEW IN-01) — this
 * read "immediately before `CHANGED_PREFIX`", which the file's own line numbers contradict,
 * and a slot argument that rests on declaration order has to survive someone checking it.
 * It must NOT go first: 192.1 asserts the provenance node at DOM position 2 BY CHILD ORDER,
 * and the point of asserting by child order was that it does not move.
 */
export const CARD_TEMPLATE_MARK = "needs a template"

/**
 * AUTH-03's Run-modal label (D-18) — it turns a nameless quiet button into a named,
 * expected input, which is the naming half of the requirement. Shown whenever
 * `templateAdmission(def) !== "does-not-admit"`; the modal hides the control only on a
 * POSITIVE no (D-20), the opposite fallback from the card's, because hiding on *unknown*
 * would strip a shipped capability (WFIN-01) from a user who may genuinely need it.
 *
 * ⚠ THE a11y CONSTRAINT TRAVELS WITH THE STRING: render it as a TEXT NODE, never as a
 * `<label htmlFor>`. The input it names is `className="hidden" tabIndex={-1}` — a label
 * pointing at a control that cannot be focused is a promise the DOM does not keep.
 *
 * The provenance sentence that sits with this control (`Stored untrusted — never run as
 * code, never fed to the fill engine.`) is Phase 152 security honesty and stays VERBATIM
 * (D-19); it is not re-homed here and must not be re-worded to read better under the new
 * label.
 */
export const RUN_TEMPLATE_LABEL = "Template to fill"

/**
 * The recency segment's prefix (D-18). ⚠ THE TRAILING SPACE IS PART OF THE STRING —
 * `relativeChanged` concatenates a band onto it (`changed 2 months ago`) and imports it from
 * here rather than typing `"changed "`, which is what makes a copy change one line.
 */
export const CHANGED_PREFIX = "changed "

// ══════════════════════════════════════════════════════════════════════════════════════
// Phase 192.2-04 (LIB-06) — THE RUN WORDS (D-01 line 2 / D-08's three arms)
// ══════════════════════════════════════════════════════════════════════════════════════
//
// The answer to *"does this one work?"*, in the five words a person can read. They live HERE
// and not in `runFacts.ts` for the reason 192.2-02 recorded when it declined to re-spell
// `Ready to run`: this module is the library subtree's ONE home for a string, and a second
// home is the drift D-14 forbids. `runFacts.ts` owns the DECISION — which arm a row is in —
// and imports the WORDS from here, exactly as `cardFace.ts` does for the state axis.
//
// ⚠ THEY ARE NOT `runVocabulary.ts`'s WORDS, AND THE DIFFERENCE IS AUDIENCE, NOT OVERSIGHT.
// That module (`components/workflows/runVocabulary.ts`) is the CANVAS's vocabulary, keyed by
// `CanvasReading` — it names what ONE STEP of a run being watched is doing right now
// (`Complete` · `Running` · `Paused for your answer` · `Stopped by you`). These name what a
// WHOLE PAST RUN of a workflow DID, read months later off a library shelf, and they are past
// tense because that is the only tense honest here. Its own docblock states the governing
// rule for exactly this case: *"one derivation, two vocabularies … Req 8's acceptance is a
// grep proving zero re-derivations — NOT that the two views print identical strings."* No
// derivation is duplicated: this file holds no status mapping at all.
//
// ⚠ AND NONE OF THEM IS A COLOUR. D-01 gives the outcome a 3px gutter mark, and the
// constraint on it is *"colour, and never colour alone"* — so every arm carries a word, and
// these are those words. A card that renders the mark without one has broken the constraint.

/**
 * The run WORKED — `workflow_runs.status = 'completed'`.
 *
 * ⚠ THE PLAIN PAST-TENSE VERB, NOT THE SYSTEM SPELLING. `Completed` is what the database says
 * and it reads as a bureaucratic state; `Worked` is the answer to the question the operator
 * actually asked of this shelf, and it is the word the approved sketch (179-C) uses.
 * Composed with a band into `Worked 2 days ago` — see `runFacts.ts`, which owns the join.
 */
export const RUN_WORKED = "Worked"

/** The run FAILED — `status = 'failed'`. Same tense, same shape: `Failed last month`. */
export const RUN_FAILED = "Failed"

/**
 * A person STOPPED the run — `status = 'cancelled'`.
 *
 * ⚠ NEITHER SUCCESS NOR FAILURE, and it must not be readable as either. A stopped run is a
 * decision somebody took, not a fault the system raised — the same distinction
 * `runVocabulary.ts`'s ninth word carries for a step, made independently here for a whole run.
 */
export const RUN_STOPPED = "Stopped"

/**
 * D-08 arm 2 — THE BACKEND LOOKED AND THERE IS NO RUN. An affirmative statement about the
 * row, and on a shelf that is 69% drafts it is the most common thing a card will say.
 *
 * ⚠ NOT A BLANK. A blank renders like an absence and reads like a tick: the whole reason D-08
 * has three arms is that *silence is not success*.
 */
export const RUN_NEVER = "Never run"

/**
 * D-08 arm 3 — THE WIRE DID NOT SAY. A frontend deployed ahead of its backend receives rows
 * with no run keys at all, and a status this build does not recognise lands here too.
 *
 * ⚠ THIS IS THE WORD THE WHOLE PLAN TURNS ON. It must never be confusable with `RUN_NEVER`
 * above: claiming *"never run"* about a workflow that has run a hundred times is the product
 * asserting something false, which is worse than admitting a gap. It says what is true — no
 * outcome is on record here — and claims nothing about whether the workflow ran.
 */
export const RUN_UNKNOWN = "Not recorded"

/**
 * Lineage state 2b — a version fork: `v3 of v2` (D-12).
 *
 * A FUNCTION, per `forkFailedMessage`'s idiom above: the interpolated half is data, and a
 * template assembled at the call site is a string that leaks out of this module's fences.
 */
export function lineageVersionOf(mine: number, parent: number): string {
  return `v${mine} of v${parent}`
}

/**
 * The VERSION discriminator segment — `v3` (D-04's fourth axis).
 *
 * ⚠ ADDED BY 192.1-05, AND IT IS THE ONE STRING THE PORT HAD TO AUTHOR RATHER THAN COPY.
 * `BUILD-CONTRACT.generated.md` declares no key for it because the sketch assembles it inline
 * (`163/index.html:316` — `segs.push("v" + row.version)`), which is precisely the drift D-14
 * exists to prevent: a string that reaches the DOM from a module that is not this one cannot be
 * changed in a one-line diff. The FORM is the mockup's, unchanged; only its home is new.
 *
 * A FUNCTION, matching `lineageVersionOf` directly above, so the two version spellings on the
 * identity line — `v3` and `v3 of v2` — cannot drift apart at a call site.
 */
export function versionLabel(version: number): string {
  return `v${version}`
}

/**
 * The collision counter — `43 share this name` (D-04: rendered ONLY on a colliding name,
 * counted over the FULL merged library before any filtering, per D-05).
 *
 * ⚠ **UAT ROW U4 WAS DRIVEN 2026-08-13 AND THE OPERATOR ANSWERED YES: `1 of 43` READ AS AN
 * INDEX.** The shipped string is therefore no longer the mockup's. The history matters more
 * than the string, so it is recorded rather than replaced:
 *
 *   - Sketch 163 rendered `ONE_OF(n) = "1 of " + n`, and it shipped VERBATIM at plan time even
 *     though the ambiguity was already noticed (D-07). The leading `1` is a CONSTANT, not a
 *     position — every colliding row read `1 of 43`; the seventh namesake did not read
 *     `7 of 43`. Rewriting an operator-approved bar string at plan time is precisely the drift
 *     sketch 163's anti-drift mechanism exists to prevent, so the concern was routed to a human
 *     instead of resolved by an executor.
 *   - The human read it in context, on their own 43-row family, and it misled them.
 *
 * **That is the mechanism working, not failing.** The question reached a person, the person
 * answered, and the answer cost ONE LINE IN ONE FILE — which is what D-14 buys and why every
 * user-visible string on this surface lives here.
 *
 * The replacement carries no leading numeral to misread, and it states the fact as the WARNING
 * it is meant to be (U4's second question): these rows are not distinguishable, and the answer
 * the product offers is to rename the copy (`FORK_DIALOG_TITLE`).
 */
export function oneOfLabel(n: number): string {
  return `${n} share this name`
}

// ══════════════════════════════════════════════════════════════════════════════════════
// Phase 192.1 (LIB-05) — THE 162-B FORK PROMPT'S VOCABULARY (D-19 / D-20)
// ══════════════════════════════════════════════════════════════════════════════════════

/**
 * THE NAME PROMPT IS AN INPUT STEP, NOT A GUARD, AND EVERY STRING BELOW CARRIES THAT CLAIM.
 *
 * D-19 reopens Phase 192's D-15 (the fork was a DIRECT FLIP, argued in `WorkflowCard.tsx:79-87`
 * on the grounds that a confirm on a non-destructive, reversible action spends the guard
 * vocabulary the delete relies on). The prompt is legal because it collects something the
 * system cannot know — a name — so it is an INPUT, and inputs do not spend guard vocabulary.
 * That claim is mechanical rather than asserted, and each clause below is a test:
 *
 *   · it asks for a NAME, never for a confirmation;
 *   · its primary button is `Create my copy` — asserting *"the primary button is not
 *     `Confirm`"* is what makes the distinction machine-checkable;
 *   · it wears no destructive styling — no victim naming, no red, no arm-to-confirm;
 *   · it WARNS AND NEVER BLOCKS on a colliding name (D-20). The only hard gate is emptiness.
 *
 * The graded-guard ladder (146-148) is therefore untouched: sheet for the live delete,
 * arm-to-confirm for the draft delete, and the fork stays outside the ladder entirely.
 *
 * ⚠ `FORK_VERB` (`:78`) AND `FORK_CONSEQUENCE` (`:91`) ARE NOT RE-DECLARED HERE. They already
 * live in this file and are read, never re-typed — and the sketch itself reads them from the
 * fixture rather than spelling them, which is the proof the mechanism works: a drifted copy of
 * either would have failed the drive that generated the contract these strings come from.
 *
 * ⚠ D-23 — NO PROMPT APPEARS ON THE ALREADY-FORKED PATH. On a published row the caller has
 * already forked, the verb OPENS the existing draft and creates nothing, so nothing is being
 * named. `FORK_CONSEQUENCE_EXISTING` (`:124`) is the sentence that path spends. Regressing
 * this re-opens the U5 blocker.
 */

/** The dialog's heading. It names the OUTCOME, not the risk. */
export const FORK_DIALOG_TITLE = "Name your copy"

/** The primary button. ⚠ NOT `Confirm` — see the section docblock; that word is the ladder's. */
export const FORK_DIALOG_OK = "Create my copy"

/** The escape. */
export const FORK_DIALOG_CANCEL = "Cancel"

/**
 * The ONE hard gate (D-20). An empty name is not a preference; there is nothing to create.
 */
export const FORK_HINT_EMPTY = "Give it a name."

/** The clear state — said plainly, so silence is never the only signal that a name is fine. */
export const FORK_HINT_FREE = "No other workflow of yours has this name."

/**
 * The collision WARNING (D-20 — it warns, it never blocks). A name you chose is a name you
 * are allowed to have; refusing it would make the library's problem the user's fault. What it
 * does instead is state the consequence in the reader's own terms, which is the same
 * both-halves rule `FORK_CONSEQUENCE` follows.
 *
 * ⚠ D-21 — this is a check on the DISPLAY NAME, over the caller's OWN rows in the merged feed,
 * and it must never be presented as a slug check. It is also NOT the WR-08 409: that is a
 * `UNIQUE(slug, version)` violation and no name field prevents it (D-22).
 */
export const FORK_HINT_CLASH =
  "You already have one called this. Allowed — but you will not be able to tell them apart."

/**
 * The dialog's sub-line — it names WHAT is being copied and says the choice is reversible,
 * because a name demanded up front with no way back is a guard wearing an input's clothes.
 *
 * A FUNCTION for `forkFailedMessage`'s reason (the interpolated half is data). The curly
 * quotes match that function's, so the two dialogs quote a workflow name the same way.
 */
export function forkDialogSub(sourceName: string): string {
  return (
    `You are copying “${sourceName}”. Give your copy a name you will recognise later — ` +
    `you can change it in the Builder.`
  )
}
