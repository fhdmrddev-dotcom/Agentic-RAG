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
