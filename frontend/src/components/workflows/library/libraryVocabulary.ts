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
