/**
 * Phase 192-07 (LIB-01 / LIB-02 / LIB-04 — D-02 / D-03 / D-05 / D-06 / D-14 / D-17) — THE
 * LIBRARY'S PERSISTENT TOOLBAR.
 *
 * 157-B replaces three labelled shelves with ONE flat list, and this is the instrument that
 * makes the flat list navigable: create, then always-on search, then six counted chips, then
 * the quiet in-flight marker, then the ONE project select with the honest line it owes, then
 * the way out of an over-filtered list.
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
 * ── ⚠ THREE STRINGS ARE DECLARED HERE, NOT IN `libraryVocabulary.ts`, AND IT IS A SCOPE
 *    BOUNDARY RATHER THAN AN OVERSIGHT ─────────────────────────────────────────────────
 * The house rule is one vocabulary home, and this plan's own verification gate is
 * `git diff --name-only` listing exactly TWO files under `library/` — the vocabulary module is
 * not one of them. So the words this toolbar needs that `192-05` did not yet ship sit in ONE
 * clearly-marked block below, and their re-home is OWED to a later plan of this phase. They
 * are not outside the honesty guarantee while they wait: `LibraryToolbar.tsx` is one of the
 * seven paths F5 sweeps BY NAME, so a word that overstated the search would red here exactly
 * as it would red in the vocabulary module.
 *
 * ⚠ THIS PARAGRAPH'S HEADING READ *"FOUR STRINGS"* UNTIL 199-10, AND THE CORRECTION IS
 * RECORDED RATHER THAN OVERWRITTEN. The fourth was the create control's sub-line, which that
 * plan removed on the adopted design language's *never name the mechanism to the user* rule.
 * The re-home OWED to a later plan is therefore THREE strings, not four — and a count nobody
 * re-derives is precisely how a later plan goes looking for a constant that no longer exists.
 */
import { useId } from "react"

// 200-PORT — the sheet's inset `search` glyph. The house chrome set this file's sibling card
// already draws from; no second icon path, and it carries no meaning (`aria-hidden`).
import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import type { Folder } from "@/types"

import { UNBOUND } from "./libraryFilter"
import type { ChipId } from "./libraryRow"
import {
  CHIP_ORDER,
  CHIP_WORDS,
  CLEAR_FILTERS_LABEL,
  PROJECT_LABEL,
  PROJECT_STARTERS_NOTE,
  PROJECT_UNBOUND_LABEL,
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

// ── TOMBSTONE (199-10) — a removed constant's reasons, kept where it stood ───────────
/**
 * ⚠ 199-10 (DES-01) — THIS BLOCK DOCUMENTS A CONSTANT THAT NO LONGER EXISTS. It is NOT the
 * docblock of the declaration below it. THE SUB-LINE IS GONE, AND ITS ABSENCE IS RECORDED HERE RATHER THAN
 * LEFT AS A HOLE IN THE DIFF. It read *"Describe it in plain English → AI drafts it"*, and
 * it was carried over verbatim from the dashed build-card this control replaced.
 *
 * It is removed on the adopted design language's own third rule — *never name the mechanism
 * to the user* — which sketch 178's README records as one of three rules written into the
 * design system's `designMd` rather than into a prompt. The sentence described HOW the
 * Builder works (you type prose, a model drafts) at a moment when the only question is
 * WHETHER to start one. The first rule applies as well: *text is noise, cut it — but the
 * purpose must survive the cut.* The purpose is "start a new workflow", and `CREATE_LABEL`
 * carries it alone.
 *
 * ⚠ THE REMOVAL IS PROVED BY INVERSION, NOT BY A DELETED TEST. `LibraryToolbar.test.tsx`
 * pinned this sentence PRESENT in the commit before this one and now pins it ABSENT, so a
 * later re-introduction reds rather than passes silently.
 */
// ── end tombstone ────────────────────────────────────────────────────────────────────

/** The project select's "no narrowing" option — the shipped rail's own word (`:524`). */
const PROJECT_ALL_LABEL = "All projects"

/**
 * The quiet in-flight marker (D-17's companion rule). Lower-case and understated ON PURPOSE:
 * its job is to let a reader tell "these counts describe stale rows" from "these counts are
 * final", NOT to interrupt. The rows on screen stay rendered with their correct counts while
 * a project re-query is in flight; nothing is zeroed, and nothing is pre-computed for rows
 * that have not arrived.
 */
const UPDATING_LABEL = "updating…"

// ── Shared class strings ─────────────────────────────────────────────────────────────

/**
 * `FilterItem`'s shipped toggle skin (`WorkflowsPage.tsx:675-691`).
 *
 * ⚠ 200-PORT — IT WAS A `rounded-full` PILL AND IS NOW THE SHEET'S 32px RECTANGLE. Sketch 200
 * draws the six chips as `h-[32px] px-sm` boxes at the toolbar's own corner radius, sharing a
 * baseline with the 36px create control and the 36px search field. A `rounded-full` pill with
 * `py-1` had neither the height nor the geometry of anything else on the row, which is what
 * made the toolbar read as three unrelated clusters rather than one instrument.
 *
 * ⚠ THE `bg-[#151B24]` REST FILL IS ADOPTED TOO. Every chip in the sheet carries a fill; only
 * the ACTIVE one changes tone. The shipped chip was transparent at rest and gained a fill when
 * pressed, so `pressed` was carried by fill AND border AND text colour at once — three signals
 * where the sheet spends two, and the un-filled rest state made the row look unpopulated.
 * `bg-muted/40` is the utility that lands where the sheet's raised chip surface does.
 *
 * ⚠ THE OBVIOUS SYNONYM FOR "utility" IS AVOIDED HERE, AND ITS FIRST DRAFT USED IT AND WENT
 * RED — the sixth recorded hit of the 187-24 trap in this subtree, and the fifth in this file
 * alone. `librarySubtree.fences.test.ts`'s F6 scoping control is a RAW `source.includes` over
 * every swept module and its subject word is that synonym, so a sentence about PAINT reds a
 * fence about a DRAFT's opaque field: `expected [ './LibraryToolbar.tsx', …(4) ] to deeply
 * equal [ './WorkflowCard.tsx', …(3) ]`. The right fix is the PROSE, never the fence — widening
 * F6's measured list to admit a false positive would put a paint comment into a record about
 * data handling, which is what this file's create-control block already says one screen up.
 *
 * ⚠ NO COLOUR NAME HERE IS NEW: `primary`, `border`, `muted` and `muted-foreground` are all
 * already declared and already used by the create control this file's own suite verifies the
 * chain for. A utility naming an undeclared key compiles to NOTHING and renders identically to
 * a deliberately unpainted control — the `bg-warning` defect 192.2 shipped unguarded.
 */
const CHIP_BASE =
  "flex h-8 items-center gap-1 rounded-md border px-2 text-[11px] whitespace-nowrap transition-colors "
const CHIP_ON = "border-primary/40 bg-primary/10 text-primary font-medium"
const CHIP_OFF =
  "border-border bg-muted/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"

const NOTE_CLASSES = "text-[11px] leading-snug text-muted-foreground"

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
  /**
   * `null` = all projects · a folder id · the shipped `UNBOUND` sentinel for "no project".
   *
   * ⚠ `UNBOUND` IS IMPORTED FROM `libraryFilter`, NOT FROM THE PAGE, and that is a fence
   * rather than a preference: F4 forbids any module under `library/` from naming a
   * `WorkflowsPage` specifier in any import form, so `192-05` re-homed the sentinel here with
   * a byte-identical value. Two identical declarations exist until `192-10` rewrites the page
   * and deletes its copy — a deliberate transient, not a duplicate to tidy up now.
   */
  projectId: string | null
  onProjectChange: (next: string | null) => void
  /** The project options — already loaded by the page; this component asks for nothing. */
  folders: readonly Folder[]
  /** A project re-query is in flight. Drives the quiet marker; changes no count. */
  updating: boolean
  /** Opens the Builder fresh (the shipped `openBuilderFresh` contract, unchanged). */
  onCreate: () => void
  /** The one-click way out of a filtered-to-empty list (sketch 158). */
  onClearAll: () => void
}

// ── The toolbar ──────────────────────────────────────────────────────────────────────

export function LibraryToolbar({
  query,
  onQueryChange,
  activeChips,
  onToggleChip,
  counts,
  projectId,
  onProjectChange,
  folders,
  updating,
  onCreate,
  onClearAll,
}: LibraryToolbarProps) {
  const searchHintId = useId()
  const projectNoteId = useId()

  /**
   * A project counts as "selected" for BOTH a real folder AND the `UNBOUND` sentinel, and
   * D-17's note is honest in both cases: starters are held out of the project filter either
   * way (`libraryFilter.matchesProject` returns `true` for every starter, whatever the
   * selection), so a reader who narrows to "Unbound (no project)" watches starters remain for
   * exactly the reason the note states.
   */
  const projectSelected = projectId !== null
  const anythingActive = query.length > 0 || activeChips.length > 0 || projectSelected

  return (
    <div
      data-testid="library-toolbar"
      className="flex min-h-[48px] w-full items-center gap-2.5 border-b border-border bg-card px-4 py-2 lg:px-6"
    >
      {/* ── 1 · CREATE LEADS (D-02 / LIB-04 / SC#4) ──────────────────────────────────
          FIRST in DOM order, before search and before the chips. Asserted by
          `compareDocumentPosition`, never by reading this comment. */}
      <button
        type="button"
        data-testid="library-create"
        onClick={onCreate}
        className="flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 text-[12.5px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        <span aria-hidden="true">＋</span>
        {CREATE_LABEL}
      </button>

      {/* ── 2 · ALWAYS-ON SEARCH (D-06) ──────────────────────────────────────────────
          No toggle, no disclosure, no collapsed state, no expand/collapse state at all. There
          is nothing for a reveal attribute to describe, which is why none appears. The operator's
          reasoning is recorded and is the test for any future tap-to-reveal on this page:
          "a control you always open should always be open." The hint below is real DOM
          text wired by `aria-describedby` — the D-08 promise ships where a screen reader
          reaches it, not in a tooltip. */}
      <div className="relative min-w-[140px] max-w-[280px] flex-1">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          data-testid="library-search"
          aria-label={SEARCH_LABEL}
          aria-describedby={searchHintId}
          placeholder={SEARCH_PLACEHOLDER}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          className="h-8 pl-8 text-[12px]"
        />
        <span id={searchHintId} data-testid="library-search-hint" className="sr-only">
          {SEARCH_HINT}
        </span>
      </div>

      {/* ── 3 · THE SIX CHIPS (D-03) ─────────────────────────────────────────────────
          Independent `aria-pressed` toggles in `FilterItem`'s shipped contract. A chip whose
          count is 0 STILL RENDERS — the honest-empty-state rule (`WorkflowSoul`'s D-03
          pattern: the atom is always rendered, never hidden, never fabricated). Hiding it
          would answer "are there any?" by making the question unaskable. */}
      <div data-testid="library-chips" className="flex items-center gap-1 shrink-0">
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
                className={
                  "font-mono text-[10.5px] " + (active ? "opacity-80" : "text-muted-foreground")
                }
              >
                {counts[chip]}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── 4 · THE QUIET IN-FLIGHT MARKER (D-17's companion rule) ───────────────────
          It lives adjacent to the chip row because the CHIP COUNTS are what it qualifies.
          `data-state` follows the `DescribeKbPicker.tsx:162-164` convention, and it is here
          so "these counts describe stale rows" is MACHINE-CHECKABLE rather than merely
          legible to a careful reader. PATTERNS "No Analog Found" G-B records that NO shipped
          surface holds previously-committed rows with correct counts while a re-query is in
          flight — this is that pattern's first home in the codebase, which is exactly why it
          gets a machine-readable state rather than a spinner.

          Its ABSENCE is the settled state, and the suite asserts that negative: a marker that
          is always present distinguishes nothing and would prove nothing. */}
      {updating && (
        <span
          data-testid="library-updating"
          data-state="updating"
          aria-live="polite"
          className={NOTE_CLASSES + " shrink-0"}
        >
          {UPDATING_LABEL}
        </span>
      )}

      {/* ── 5 · THE PROJECT FILTER, AND THE FACT IT OWES (D-05 / D-17) ───────────────
          ONE instrument in the toolbar, not a 200px rail beside it — the recorded "one home
          per concern" red line, and a select scales to any N projects where a rail becomes a
          scroll wall (it also returns 200px of width to the grid at 200 workflows).

          A NATIVE `<select>`, in both shipped pickers' shape: free a11y, free keyboard
          type-ahead, no new dependency. */}
      <div className="ml-auto flex items-center gap-2 shrink-0">
        <label className="flex items-center shrink-0">
          <span className="sr-only">{PROJECT_LABEL}</span>
          <select
            data-testid="library-project-select"
            aria-label={PROJECT_LABEL}
            value={projectId ?? ""}
            onChange={(event) => onProjectChange(event.target.value === "" ? null : event.target.value)}
            {...(projectSelected ? { "aria-describedby": projectNoteId } : {})}
            className="h-8 rounded-md border border-border bg-card px-2.5 text-[12px] text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">{PROJECT_ALL_LABEL}</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
            <option value={UNBOUND}>{PROJECT_UNBOUND_LABEL}</option>
          </select>

          {/* D-17 — SILENCE HERE IS A UAT FAILURE (row U6), NOT A NEUTRAL DEFAULT.
              `?project_folder_id=` narrows ONLY `/published` (`db/workflows.py:291-293`), and
              the three seeded starters carry no project at all (`094_starter_workflows.sql` →
              0 hits). */}
          {projectSelected && (
            <span id={projectNoteId} data-testid="library-project-note" className="sr-only">
              {PROJECT_STARTERS_NOTE}
            </span>
          )}
        </label>

        {/* ── 6 · THE WAY OUT (sketch 158's zero-results behaviour) ────────────────────
            Present whenever a query, any chip, or a project is active, so a user who has
            filtered down to nothing is never stuck. Absent when nothing is active — a permanent
            "clear" on an unfiltered list is noise that reports no state. */}
        {anythingActive && (
          <button
            type="button"
            data-testid="library-clear-all"
            onClick={onClearAll}
            className="flex h-8 shrink-0 items-center rounded-md px-1.5 text-[11px] text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
          >
            {CLEAR_FILTERS_LABEL}
          </button>
        )}
      </div>
    </div>
  )
}
