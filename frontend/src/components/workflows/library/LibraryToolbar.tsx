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
  "flex h-8 items-center gap-1.5 rounded border px-2.5 text-[11.5px] whitespace-nowrap transition-colors "
const CHIP_ON = "border-primary/40 bg-primary/10 text-primary"
const CHIP_OFF =
  "border-border bg-muted/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"

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
    // ⚠ 200-PORT — ONE ROW, ON ONE BASELINE, WITH THE PROJECT CONTROL PUSHED RIGHT.
    //
    // It read `flex flex-wrap items-start gap-x-4 gap-y-3 … py-3`: a wrapping, TOP-aligned bag
    // in which a 36px button, a two-line search column, a row of pills and a two-line select
    // column all began at the same y and ended at four different ones. Sketch 200 draws a
    // single `h-[68px]` band, `items-center`, `justify-between`, on a RAISED surface
    // (`bg-[#0D1117]` against the canvas's `#060A0F`) — so the instruments read as one strip
    // and the canvas below reads as content.
    //
    // ⚠ `min-h-[68px]` RATHER THAN THE SHEET'S FIXED `h-[68px]`, AND THE DIFFERENCE IS OWED TO
    // TWO SENTENCES THE SHEET DOES NOT DRAW AND THIS SURFACE MAY NOT DROP: the search field's
    // D-08 hint and the project select's D-17 starters note. Both are honesty contracts — the
    // note exists because `?project_folder_id=` narrows only the published feed, a fact that
    // reads as a BROKEN FILTER if left unsaid (UAT row U6) — and both are REAL DOM TEXT wired
    // by `aria-describedby`, never a tooltip, because touch has no hover. Fixing the height
    // would have meant hiding one of them; the band gives instead.
    //
    // ⚠ `flex-wrap` SURVIVES for the same reason it was there: below ~1100px the six chips and
    // the select cannot share a line with the create control at any height, and a `nowrap` row
    // would put the project filter off-screen rather than under the chips.
    <div
      data-testid="library-toolbar"
      className="flex min-h-[68px] flex-wrap items-center gap-x-4 gap-y-3 border-b border-border bg-card px-6 py-3"
    >
      {/* ── 1 · CREATE LEADS (D-02 / LIB-04 / SC#4) ──────────────────────────────────
          FIRST in DOM order, before search and before the chips. Asserted by
          `compareDocumentPosition`, never by reading this comment. */}
      {/* ⚠ 199-10 (DES-01) — ONE LINE, ON THE TOOLBAR'S SHARED BASELINE, AND THE ONE
          AFFIRMATIVE SKIN ON THE ROW.

          Sheet c6 draws the toolbar's controls on ONE shared baseline and gives the create
          affordance the only filled treatment on it. The shipped control was a two-line
          DASHED box — the skin of the build-CARD it replaced, which made sense inside a grid
          of cards and reads as an unfinished placeholder in a toolbar. It is now `h-9`, the
          same height the search `Input` already renders at, so "one shared baseline" is a
          property of the markup rather than of a screenshot.

          ⚠ THE SHEET'S OWN PLACEMENT IS REFUSED. c6 puts create LAST on the row, behind an
          `ml-auto`. D-02 is the structural fix for SC#4 and it says create LEADS; a visual
          demotion that left DOM order intact would ALSO be a keyboard regression, since this
          control is index 0 of every focusable node in the toolbar. Both orders are asserted.

          ⚠ `bg-primary` / `text-primary-foreground` are VERIFIED TO RESOLVE against
          `tailwind.config.js` and `index.css` by this file's suite, not assumed. A Tailwind
          utility naming a key nobody declared compiles to NOTHING and renders identically to
          a deliberately unpainted control — the `bg-warning` defect 192.2 shipped unguarded,
          and 15 of sheet 178's own 18 colour NAMES are in exactly that state here.

          ⚠ THE WORD "colour NAMES" IS DELIBERATE AND THE OBVIOUS SYNONYM IS AVOIDED, for the
          same reason this file already declines to spell the tooltip attribute above.
          `librarySubtree.fences.test.ts`'s F6 scoping control is a RAW `source.includes`
          over this module, and its subject word is a substring of that synonym's plural — so
          a comment about PAINT reds a fence about a DRAFT's opaque field. Measured, not
          reasoned about: this paragraph's first draft failed F6 with
          *"expected [ './LibraryToolbar.tsx', …(4) ] to deeply equal [ './WorkflowCard.tsx', …(3) ]"*.
          The 187-24 trap, which this subtree has now recorded a fifth time. The right fix is
          the prose, never the fence: widening F6's measured list to admit a false positive
          would put a paint comment into a record about data handling. */}
      <button
        type="button"
        data-testid="library-create"
        onClick={onCreate}
        className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
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
      {/* ⚠ 200-PORT — A FIXED 280px FIELD WITH THE SHEET'S INSET MAGNIFIER.
          The sheet gives search a `w-[280px]` box and parks a `search` glyph inside it at
          `left-3`. It read `min-w-[220px] flex-1`, which let the field swallow every pixel the
          chips did not want — at 1600px it ran to ~700px, wider than the toolbar's other five
          controls combined, for a field that holds a few words. The glyph is `aria-hidden` and
          `pointer-events-none`: the field's accessible name is still `SEARCH_LABEL`, and the
          D-08 hint below is still real DOM text wired by `aria-describedby`. */}
      <div className="flex w-[280px] min-w-[200px] flex-col gap-1">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            data-testid="library-search"
            aria-label={SEARCH_LABEL}
            aria-describedby={searchHintId}
            placeholder={SEARCH_PLACEHOLDER}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            className="h-9 pl-9"
          />
        </div>
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
                /* ⚠ 200-PORT — the sheet's `font-data-sm` count: mono, 11px, and DIM rather
                   than merely faded. `text-[9.5px] opacity-70` rendered the number smaller
                   than any other text in the product and, at 70% of an already-muted
                   foreground, close to unreadable — on the one atom whose entire job is to be
                   a legible quantity. The tone now comes from the chip's own text colour on
                   the active arm and `text-muted-foreground` at rest, so it is a colour
                   decision rather than a transparency accident. */
                className={
                  "font-mono text-[11px] " + (active ? "opacity-80" : "text-muted-foreground")
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
          className={NOTE_CLASSES}
        >
          {UPDATING_LABEL}
        </span>
      )}

      {/* ── 5 · THE PROJECT FILTER, AND THE FACT IT OWES (D-05 / D-17) ───────────────
          ONE instrument in the toolbar, not a 200px rail beside it — the recorded "one home
          per concern" red line, and a select scales to any N projects where a rail becomes a
          scroll wall (it also returns 200px of width to the grid at 200 workflows).

          A NATIVE `<select>`, in both shipped pickers' shape: free a11y, free keyboard
          type-ahead, no new dependency. Deliberately NOT a command palette — Radix `Select`
          ships no built-in search, no command-palette package exists in `package.json` today,
          and 158-B's deferral was costed against adding exactly one. If a filter over the
          options is wanted later it is a change to THIS ONE CONTROL, not a package.

          ⚠ The forbidden package is not NAMED here for the same reason the tooltip attribute
          is not spelled above: T-192-SC's check is a raw count of its name in this file, and
          prose explaining why it is absent would satisfy the grep that proves it absent. */}
      {/* ⚠ 200-PORT — RIGHT-ALIGNED, AT THE SHEET'S 160px FLOOR, ON THE SHARED BASELINE.
          Sketch 200 sets the project control apart from the create/search/chips cluster by
          pushing it to the far end of the band (`justify-between`, `min-w-[160px] shrink-0`) —
          it narrows the WHOLE list rather than acting on it, so it does not belong in the
          instrument cluster. `ml-auto` does that WITHOUT touching DOM order, which matters:
          create is asserted to be index 0 of every focusable node in this toolbar, and a
          visual re-order achieved with `order-*` would be a keyboard regression this file's
          own suite is written to catch. The select itself takes `h-9` so it lands on the same
          baseline as the create control and the search field. */}
      <label className="ml-auto flex min-w-[160px] shrink-0 flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {PROJECT_LABEL}
        </span>
        <select
          data-testid="library-project-select"
          aria-label={PROJECT_LABEL}
          value={projectId ?? ""}
          onChange={(event) => onProjectChange(event.target.value === "" ? null : event.target.value)}
          {...(projectSelected ? { "aria-describedby": projectNoteId } : {})}
          className="h-9 rounded-md border border-border bg-card px-2 text-[12.5px] text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
            0 hits). Under three labelled shelves that read as "the filter applies to
            Published"; under 157-B's single flat list it reads as a BROKEN FILTER. A starter
            having no project is a property of the DATA, not a gap in the filter — so the
            honest surface states the fact in plain words rather than silently dropping the
            rows or silently ignoring the selection.

            It is wired to the select by `aria-describedby`, so the reason reaches a screen
            reader on the control it explains — and it is real DOM text, never a tooltip. */}
        {projectSelected && (
          <span id={projectNoteId} data-testid="library-project-note" className={NOTE_CLASSES}>
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
          className="self-center rounded-md px-2 py-1 text-[11.5px] text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
        >
          {CLEAR_FILTERS_LABEL}
        </button>
      )}
    </div>
  )
}
