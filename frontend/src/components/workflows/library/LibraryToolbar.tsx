/**
 * Phase 192-07 (LIB-01 / LIB-02 / LIB-04 — D-02 / D-03 / D-06 / D-14) — THE LIBRARY'S
 * PERSISTENT TOOLBAR.
 *
 * 157-B replaces three labelled shelves with ONE flat list, and this is the instrument that
 * makes the flat list navigable: create, then always-on search, then six counted chips. Task 2
 * of this plan adds the project select, its D-17 note, the in-flight marker and clear-all.
 *
 * ── WHY THE CREATE CONTROL IS FIRST, AND WHY THAT IS THE WHOLE FIX ──────────────────────
 * SC#4 asks that the create affordance be reachable without scrolling past existing
 * workflows. Today it is the FIRST CELL OF THE THIRD GRID (`WorkflowsPage.tsx:613`, measured
 * at this commit) — below the starters shelf and below the published shelf. D-02 does not fix
 * that by promoting it one shelf up; it fixes it STRUCTURALLY, by moving it out of a grid
 * entirely. An affordance that leads a persistent toolbar cannot drift back down a grid,
 * because there is no grid above it to drift below. That is a property of the composition
 * rather than of anybody's vigilance, which is why the DOM ORDER is asserted
 * (`LibraryToolbar.test.tsx`, `compareDocumentPosition`) rather than assumed from the order
 * the JSX happens to read in today.
 *
 * ── PRESENTATIONAL, AND STRICTLY SO ─────────────────────────────────────────────────────
 * This component FETCHES NOTHING and OWNS NO LIST STATE. Every number it renders arrives as a
 * prop, computed by `libraryFilter.chipCounts` over the rows the page is ACTUALLY RENDERING.
 * Recomputing a count here would mean a second copy of the six predicates, and two copies of
 * a predicate is the drift the `soulData.ts` docblock forbids by name: the chip would promise
 * a number the list could not deliver, which is precisely the failure D-03 exists to prevent.
 *
 * It also exports NO RUNTIME VALUE besides the component. `react-refresh/only-export-components`
 * errors otherwise, and that lint rule is the mechanical reason the chip table, the predicates
 * and the words live in `192-05`'s leaf modules rather than here.
 *
 * ── ZERO HOVER-ONLY TOOLTIP ATTRIBUTES ANYWHERE IN THIS FILE (D-14) ─────────────────────
 * TOUCH HAS NO HOVER. An explanation parked in a tooltip is an explanation half this product's
 * users never receive, so every reason on this surface is REAL DOM TEXT, wired by
 * `aria-describedby` where it belongs to a control — the `GovernanceSection.tsx` /
 * `ConnectionPicker.tsx` rule, applied here to the search field. `librarySubtree.fences.test.ts`
 * F1 parses this file's JSX attributes and this plan's own suite asserts the RENDERED DOM
 * carries none, WITH a positive control proving the selector can find one.
 *
 * ⚠ The forbidden attribute is deliberately NOT SPELLED OUT with its equals sign anywhere in
 * this file — not even in this prose. `192-05` had to make F1 a PARSED fence precisely because
 * `libraryVocabulary.ts` names the attribute in its own docblock and a raw source grep
 * therefore reds on the file that documents the rule (the 187-24 trap, inverted). The parsed
 * fence is the authority either way; keeping the raw grep at a truthful 0 as well costs one
 * word of phrasing and spares a later reader the adjudication.
 *
 * ── ZERO INVENTED GLYPHS (icon-convention §4, via PATTERNS §S-9) ────────────────────────
 * Five of the six chips carry NO MARK AT ALL. They are word-badges: the word does the work,
 * and a mark would spend visual budget the design deliberately withholds. There is no
 * category-icon vocabulary in this product and inventing one — or repurposing a phase-type
 * glyph as one — is the exact drift §4 forbids, because a workflow's identity on a row is
 * already carried by its glyph-dot PHASE SPINE. The sixth chip's mark is READ from
 * `TIERS.STRICT.glyph` through `libraryVocabulary`, so `grep -c "🔒"` on this file is 0 and
 * the chip is provably the same mark as the card's own tier atom rather than a second mark
 * that agrees today.
 *
 * ── ⚠ TWO STRINGS ARE DECLARED HERE, NOT IN `libraryVocabulary.ts`, AND IT IS A SCOPE
 *    BOUNDARY RATHER THAN AN OVERSIGHT ─────────────────────────────────────────────────
 * The house rule is one vocabulary home, and this plan's own verification gate is
 * `git diff --name-only` listing exactly TWO files under `library/` — the vocabulary module is
 * not one of them. So the words this toolbar needs that `192-05` did not yet ship sit in ONE
 * clearly-marked block below, and their re-home is OWED to a later plan of this phase. They
 * are not outside the honesty guarantee while they wait: `LibraryToolbar.tsx` is one of the
 * seven paths F5 sweeps BY NAME, so a word that overstated the search would red here exactly
 * as it would red in the vocabulary module.
 */
import { useId } from "react"

import { Input } from "@/components/ui/input"

import type { ChipId } from "./libraryRow"
import {
  CHIP_ORDER,
  CHIP_WORDS,
  SEARCH_HINT,
  SEARCH_LABEL,
  SEARCH_PLACEHOLDER,
} from "./libraryVocabulary"

// ── The words owed a re-home (see the ⚠ paragraph above) ─────────────────────────────

/**
 * The create affordance's word, carried over VERBATIM from the dashed build-card it replaces
 * (`WorkflowsPage.tsx:622`). The affordance's JOB is unchanged — it opens the Builder fresh —
 * and only its PLACE changes, so changing its word at the same time would make the move
 * unreadable in a diff and unrecognisable to a returning user.
 */
const CREATE_LABEL = "Build a workflow"

/** The build-card's sub-line, also verbatim (`WorkflowsPage.tsx:624`). */
const CREATE_SUBLABEL = "Describe it in plain English → AI drafts it"

// ── Shared class strings ─────────────────────────────────────────────────────────────

/** `FilterItem`'s shipped toggle skin (`WorkflowsPage.tsx:675-691`), as a pill. */
const CHIP_BASE =
  "flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] transition-colors "
const CHIP_ON = "border-primary/40 bg-primary/10 text-primary"
const CHIP_OFF = "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"

const NOTE_CLASSES = "text-[11.5px] leading-snug text-muted-foreground"

// ── Props ────────────────────────────────────────────────────────────────────────────

export interface LibraryToolbarProps {
  /** The live search text. Owned by the page; this component never stores it. */
  query: string
  onQueryChange: (next: string) => void
  /**
   * The chips currently pressed. They compose as a UNION downstream
   * (`libraryFilter.filterLibrary`) — under an intersection, two disjoint chips would render
   * an empty list both had just promised was full.
   */
  activeChips: readonly ChipId[]
  onToggleChip: (chip: ChipId) => void
  /**
   * Each chip's honest number, from `libraryFilter.chipCounts` over the RENDERED rows. Total
   * over `ChipId`, so a seventh chip is a typecheck error at the call site rather than a chip
   * that renders blank.
   */
  counts: Record<ChipId, number>
  /** Opens the Builder fresh (the shipped `openBuilderFresh` contract, unchanged). */
  onCreate: () => void
}

// ── The toolbar ──────────────────────────────────────────────────────────────────────

export function LibraryToolbar({
  query,
  onQueryChange,
  activeChips,
  onToggleChip,
  counts,
  onCreate,
}: LibraryToolbarProps) {
  const searchHintId = useId()

  return (
    <div
      data-testid="library-toolbar"
      className="flex flex-wrap items-start gap-x-4 gap-y-3 border-b border-border px-6 py-3"
    >
      {/* ── 1 · CREATE LEADS (D-02 / LIB-04 / SC#4) ──────────────────────────────────
          FIRST in DOM order, before search and before the chips. Asserted by
          `compareDocumentPosition`, never by reading this comment. */}
      <button
        type="button"
        data-testid="library-create"
        onClick={onCreate}
        className="flex flex-col items-start gap-0.5 rounded-md border border-dashed border-border px-3 py-1.5 text-left transition-colors hover:border-primary/60"
      >
        <span className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
          <span aria-hidden="true" className="text-muted-foreground">
            ＋
          </span>
          {CREATE_LABEL}
        </span>
        <span className="text-[11px] text-muted-foreground">{CREATE_SUBLABEL}</span>
      </button>

      {/* ── 2 · ALWAYS-ON SEARCH (D-06) ──────────────────────────────────────────────
          No toggle, no disclosure, no collapsed state, no expand/collapse state at all. There
          is nothing for a reveal attribute to describe, which is why none appears. The operator's
          reasoning is recorded and is the test for any future tap-to-reveal on this page:
          "a control you always open should always be open." The hint below is real DOM
          text wired by `aria-describedby` — the D-08 promise ships where a screen reader
          reaches it, not in a tooltip. */}
      <div className="flex min-w-[220px] flex-1 flex-col gap-1">
        <Input
          type="search"
          data-testid="library-search"
          aria-label={SEARCH_LABEL}
          aria-describedby={searchHintId}
          placeholder={SEARCH_PLACEHOLDER}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          className="h-9"
        />
        <span id={searchHintId} data-testid="library-search-hint" className={NOTE_CLASSES}>
          {SEARCH_HINT}
        </span>
      </div>

      {/* ── 3 · THE SIX CHIPS (D-03) ─────────────────────────────────────────────────
          Independent `aria-pressed` toggles in `FilterItem`'s shipped contract. A chip whose
          count is 0 STILL RENDERS — the honest-empty-state rule (`WorkflowSoul`'s D-03
          pattern: the atom is always rendered, never hidden, never fabricated). Hiding it
          would answer "are there any?" by making the question unaskable. */}
      <div data-testid="library-chips" className="flex flex-wrap items-center gap-1.5">
        {CHIP_ORDER.map((chip) => {
          const word = CHIP_WORDS[chip]
          const active = activeChips.includes(chip)
          return (
            <button
              key={chip}
              type="button"
              data-testid={`library-chip-${chip}`}
              data-chip={chip}
              aria-pressed={active}
              onClick={() => onToggleChip(chip)}
              className={CHIP_BASE + (active ? CHIP_ON : CHIP_OFF)}
            >
              {word.glyph !== null && <span aria-hidden="true">{word.glyph}</span>}
              <span className="truncate">{word.label}</span>
              <span
                data-testid={`library-chip-count-${chip}`}
                className="font-mono text-[9.5px] opacity-70"
              >
                {counts[chip]}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
