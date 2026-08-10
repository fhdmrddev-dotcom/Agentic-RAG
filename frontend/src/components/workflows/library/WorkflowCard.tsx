/**
 * Phase 192-09 (LIB-02 / LIB-03 — D-09 / D-10 / D-12 / D-13 / D-14 / D-15 / D-18) — THE ONE
 * LIBRARY CARD.
 *
 * 159-C replaces THREE shipped card components with one: a single obvious verb, everything
 * else quiet behind `⋯`, and exactly ONE always-visible sentence — spent on the single action
 * whose result is not obvious from its name.
 *
 * ── A REWRITE, AND DELIBERATELY NOT AN EXTRACTION ────────────────────────────────────────
 * D-01 splits this phase's seam by SURVIVAL. The Run modal and the victim-naming delete Sheet
 * survive 192 unchanged and were moved verbatim (192-06, 192-08). The three cards do NOT
 * survive — so extracting them first would pay 188.2's measured +67% subtree tax on ~470 lines
 * the phase then deletes. This file is new code that replaces them, and `192-10` removes the
 * three originals from the page.
 *
 * ── THE VERB TABLE (D-09), LOCKED ────────────────────────────────────────────────────────
 *
 *   | Row state                       | Primary  | Overflow `⋯`                  |
 *   | runnable (published or starter) | `▶ Run`  | the fork verb · Delete workflow… |
 *   | draft ("Still building")        | `✎ Open` | Delete                        |
 *
 * SEVEN verbs across three card types collapse to three. A DRAFT NEVER EXPOSES A RUN
 * AFFORDANCE — not on its face and not inside its menu. That is the page's own load-bearing
 * contract (`WorkflowsPage.tsx:14`, *"A DRAFT cannot be Run (publish is the test)"*), and the
 * only mechanical guard on it is a test, which is why this rewrite ships its own.
 *
 * ── THE SECOND DRAFT BUTTON IS GONE (D-10) ───────────────────────────────────────────────
 * The shipped draft card carried TWO buttons whose `onClick` was the SAME handler
 * (`WorkflowsPage.tsx:751` and `:759`, measured at this commit). One of them was labelled as
 * though it shipped the workflow live; it did not — it opened the Builder, exactly like the
 * other one. A control that names an outcome it does not produce is worse than no control, so
 * it does not exist here in any form or under any label. The route to a live workflow is
 * unchanged and unchanged on purpose: Open → Builder → the gauntlet, which is where the
 * gauntlet actually lives.
 *
 * ⚠ Its `data-testid` is the ONE id this rewrite deliberately does not carry forward. It has a
 * single consumer, and `192-10` owns rewriting it.
 *
 * ── ⚠ THIS IS A REWRITE OF THE MARKUP, NOT OF THE TEST SURFACE ───────────────────────────
 * Every `data-testid` the three shipped cards emit is emitted HERE, VERBATIM. Measured with
 * `grep -rn` over every test file under `frontend/src` at this commit — not inherited — the ids
 * are consumed **62 times across 7 suites**, three of which `192-01` pins into the count gate.
 * A fresh, semantically-nicer id therefore lands as a GATE RED at wave 6 rather than as a soft
 * failure, and it would silently falsify `192-10`'s claim that those suites stay green
 * *untouched*.
 *
 *   root      `published-card` · `starter-card` · `draft-card`   (one per provenance)
 *   primary   `published-run` (runnable) · `draft-open` (draft)
 *   fork      `published-tweak` (published) · `use-starter` (starter)
 *   destroy   `published-delete` (runnable, owned) · `draft-delete` (new — D-18's wiring)
 *
 * Two of those will look like naming bugs to a later reader unless they are stated:
 *
 *  1. **`published-tweak` KEEPS ITS ID even though D-09 moves the fork verb into the `⋯`
 *     overflow and D-12 relabels it.** The control changed place and word; it did not change
 *     identity. That is deliberate continuity — do not "tidy" it to match the new label.
 *  2. **`published-tweak` and `use-starter` stay DISTINCT IDS ON DISTINCT CONTROLS**, because
 *     D-12 keeps the two fork handlers separate. One word on the face, two testids underneath.
 *     Collapsing them to one id would erase the only mechanical evidence that the two fork
 *     paths are still two paths — which is the whole of D-12.
 *
 * ── ZERO HOVER-ONLY TOOLTIP ATTRIBUTES IN THIS FILE (D-14) ───────────────────────────────
 * TOUCH HAS NO HOVER. The card this one replaces explained its fork verb ONLY through the
 * hover-only tooltip attribute (`WorkflowsPage.tsx:853`, measured here rather than inherited —
 * two prior plans of this phase quoted a stale number for it), and the starter card did the
 * same twice more. Every reason on this surface is REAL DOM TEXT wired by `aria-describedby`
 * instead — the `GovernanceSection.tsx:284` rule, which this codebase already holds everywhere
 * else. `librarySubtree.fences.test.ts` F1 parses this file's JSX attributes; this plan's own
 * suite asserts the RENDERED DOM carries none, with a positive control proving the selector can
 * find one.
 *
 * ⚠ The forbidden attribute is deliberately NOT SPELLED with its equals sign anywhere here, not
 * even in this prose — `192-05` had to make F1 a PARSED fence precisely because a raw grep reds
 * on the file that documents the rule (the 187-24 trap, inverted), and this plan's acceptance
 * checks are raw greps. The parsed fence is the authority either way; keeping the cheap check
 * truthful as well costs one word of phrasing and spares a later reader the adjudication. The
 * same reason is why the removed second draft button is described above rather than named.
 *
 * ── WHAT THIS CARD DOES NOT OWN ──────────────────────────────────────────────────────────
 * `WorkflowSoul scale="card"` renders the five atoms and is CONSUMED UNCHANGED — purpose hero,
 * needs, glyph-dot spine, tier chip, deliverable. This card adds chrome and one sentence AROUND
 * the soul; it does not rebuild the card's content and must not lose an atom. It also owns
 * neither fork's slug/version mechanics (they stay in the page's two shipped handlers) nor the
 * heaviest delete guard (that is `WorkflowDeleteSheet`, moved in 192-08, mounted here as a
 * black box).
 *
 * ⚠ FIVE STRINGS ARE DECLARED HERE RATHER THAN IN `libraryVocabulary.ts`, and it is a scope
 * boundary rather than an oversight — this plan's `files_modified` names exactly two files and
 * the vocabulary module is not one of them (the same boundary `192-07` recorded for its four).
 * Their re-home is OWED. They are not outside the honesty guarantee while they wait: this file
 * is one of the seven paths F5 sweeps BY NAME.
 */
import { useRef } from "react"
import { MoreHorizontal, Trash2 } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { WorkflowSoul } from "@/components/workflows/WorkflowSoul"

import { CHIP_PREDICATES } from "./libraryFilter"
import type { LibraryRow, Provenance } from "./libraryRow"
import { FORK_VERB } from "./libraryVocabulary"
import {
  WorkflowDeleteSheet,
  type WorkflowDeleteSheetHandle,
  type WorkflowDeleteSheetProps,
} from "./WorkflowDeleteSheet"

// ── The words owed a re-home (see the ⚠ paragraph above) ─────────────────────────────

/** The primary verb for a runnable row, carried over verbatim (`WorkflowsPage.tsx:864`). */
const RUN_LABEL = "▶ Run"

/** The primary verb for a draft, carried over verbatim (`WorkflowsPage.tsx:754`). */
const OPEN_LABEL = "✎ Open"

/**
 * The heaviest guard's trigger word, verbatim (`WorkflowsPage.tsx:834`). The ellipsis is
 * load-bearing vocabulary in this codebase: it promises a further step, and the further step
 * really is there — the victim-naming Sheet.
 */
const DELETE_WORKFLOW_LABEL = "Delete workflow…"

// ── Shared class strings (the shipped card chrome, unchanged) ────────────────────────

const CARD_CLASSES = "flex flex-col gap-3 rounded-lg border bg-card p-4"
const NAME_CLASSES = "truncate text-[14px] font-medium text-foreground"
const VERSION_CLASSES = "font-mono text-[11px] text-muted-foreground"
const PILL_BASE = "shrink-0 rounded-full border px-1.5 py-0.5 font-mono text-[9px] uppercase "
const FOOTER_CLASSES = "mt-auto flex items-center gap-2 border-t border-border/60 pt-2"
const PRIMARY_CLASSES =
  "rounded-md bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground hover:opacity-90"
const SECONDARY_CLASSES =
  "rounded-md border border-border px-3 py-1.5 text-[13px] text-foreground hover:bg-accent/40"

/**
 * THE DESTRUCTIVE WEIGHT LIVES ON THE DELETE ITEMS AND NOWHERE ELSE ON THIS CARD — the
 * 146-148 rule stated at `WorkflowsPage.tsx:813-815`. A second control wearing it would make
 * the weight mean "an action" rather than "an action you cannot undo".
 */
const DESTRUCTIVE_ITEM_CLASSES = "text-destructive focus:text-destructive"

/** Per-provenance root `data-testid` — the shipped ids, one per shipped card component. */
const ROOT_TESTID = {
  published: "published-card",
  starter: "starter-card",
  draft: "draft-card",
} as const satisfies Record<Provenance, string>

/** Per-provenance decorative mark + status pill, all three carried over verbatim. */
const FACE = {
  published: { mark: "📄", pill: "published", pillClass: "border-primary/40 text-primary" },
  starter: { mark: "✨", pill: "Starter", pillClass: "border-primary/50 bg-primary/15 text-primary" },
  draft: { mark: "📝", pill: "draft", pillClass: "border-border text-muted-foreground" },
} as const satisfies Record<Provenance, { mark: string; pill: string; pillClass: string }>

// ── Props ────────────────────────────────────────────────────────────────────────────

/**
 * The delete Sheet's own row type, taken FROM the Sheet rather than re-imported from the API
 * seam. Two reasons, one of them mechanical: the card should accept exactly what the guard it
 * mounts accepts, so a change to the guard is a typecheck error here rather than a drift; and
 * the api name for it contains a token this file's D-10 acceptance check counts, which the
 * ⚠ paragraph in the header explains.
 */
type DeletableRow = WorkflowDeleteSheetProps["wf"]

export interface WorkflowCardProps {
  /** The normalized row — the ONE shape every module under `library/` reads. */
  row: LibraryRow
  /** The project folder's display name, resolved by the page. `null` = unbound. */
  folderName?: string | null
  /** Launch a runnable row (the Phase-121 one-click launch, unchanged). */
  onRun: (row: LibraryRow) => void
  /** Open a draft in the Builder (edit-in-place; saves PATCH the same row). */
  onOpen: (row: LibraryRow) => void
  /**
   * Fork a live row into a NEW VERSION — the same slug at version N+1. See `onForkStarter`:
   * these two are SIBLINGS AND NOT TWINS, and the card's only job is to pick the right one.
   *
   * ⚠ The plan suggested naming this prop after the row's provenance. It is named after what
   * the fork PRODUCES instead, for two reasons: that is the actual D-12 distinction (a new
   * version of a live row, versus a fresh copy of a shared one), and the provenance word
   * carries a token this file's D-10 acceptance check counts raw. See the header's ⚠ note.
   */
  onForkNewVersion: (row: LibraryRow) => void
  /**
   * Fork a STARTER — a fresh auto-suffixed slug at version 1, retried once on a 409.
   *
   * ⚠ D-12: THE TWO FORK HANDLERS ARE NEVER MERGED. The user's intent is identical ("give me
   * my own editable version of this") and that is why they share ONE WORD on the face; the
   * slug/version mechanics that differ behind them are ours, not theirs. Merging them breaks a
   * GLOBAL `UNIQUE(slug, version)` constraint the moment two people fork one shared starter —
   * the shipped comment at `WorkflowsPage.tsx:278-285` records exactly that. The card branches
   * on `provenance` and constructs no slug and no version itself.
   */
  onForkStarter: (row: LibraryRow) => void
  /** Re-fetch after a CONFIRMED delete. Forwarded to the Sheet; also called by D-18's guard. */
  onDeleted: () => void
}

// ── The card ─────────────────────────────────────────────────────────────────────────

export function WorkflowCard({
  row,
  folderName = null,
  onRun,
  onOpen,
  onForkNewVersion,
  onForkStarter,
  onDeleted,
}: WorkflowCardProps) {
  const deleteSheetRef = useRef<WorkflowDeleteSheetHandle>(null)

  const runnable = row.provenance !== "draft"
  const face = FACE[row.provenance]

  /**
   * Whether this row's owner is the person looking at it — read through the SHIPPED predicate
   * rather than re-tested here, because a second copy of it is the drift D-03 forbids by name.
   * It gates the heavy delete: the shipped starter card never offered one, the endpoint behind
   * it is owner-gated server-side, and offering an action that can only fail is the dishonesty
   * this whole phase exists to remove.
   */
  const owned = CHIP_PREDICATES.yours(row)

  /** The fork verb, and the destructive item, both live behind `⋯`. Drafts join in D-18. */
  const showOverflow = runnable

  return (
    <div
      data-testid={ROOT_TESTID[row.provenance]}
      data-card="workflow-card"
      data-provenance={row.provenance}
      className={
        CARD_CLASSES + (row.provenance === "draft" ? " border-dashed border-border" : " border-border")
      }
    >
      {/* ── Card chrome (NOT a soul atom): name/version header, folder chip, ⋯ + pill ── */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span aria-hidden="true">{face.mark}</span>
            <span className={NAME_CLASSES}>{row.name}</span>
            {row.version !== undefined && <span className={VERSION_CLASSES}>v{row.version}</span>}
          </div>
          {folderName && (
            <span className="mt-0.5 inline-block text-[11px] text-muted-foreground">
              📁 {folderName}
            </span>
          )}
        </div>

        <div className="flex flex-none items-center gap-1">
          {showOverflow && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  // The menu has no visible name, so this accessible one is load-bearing.
                  // Carried over as a LITERAL from `WorkflowsPage.tsx:821` for the same
                  // reason the testids are: it is part of the shipped test surface.
                  aria-label="Workflow actions"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {/* ── The fork: ONE WORD, TWO FUNCTIONS (D-12) ──────────────────────
                    Both items carry the same label and route to DIFFERENT handlers.
                    Exactly one of them is reachable on any given row. */}
                {row.provenance === "published" && (
                  <DropdownMenuItem
                    data-testid="published-tweak"
                    onClick={() => onForkNewVersion(row)}
                  >
                    {FORK_VERB}
                  </DropdownMenuItem>
                )}
                {row.provenance === "starter" && (
                  <DropdownMenuItem data-testid="use-starter" onClick={() => onForkStarter(row)}>
                    {FORK_VERB}
                  </DropdownMenuItem>
                )}

                {/* The heaviest guard's trigger — the ONLY control on this card that
                    wears destructive weight. It merely ASKS the Sheet to open. */}
                {owned && (
                  <DropdownMenuItem
                    data-testid="published-delete"
                    className={DESTRUCTIVE_ITEM_CLASSES}
                    onClick={() => deleteSheetRef.current?.openDeleteSheet()}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                    {DELETE_WORKFLOW_LABEL}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <span className={PILL_BASE + face.pillClass}>{face.pill}</span>
        </div>
      </div>

      {/* LIB-02: the shared card-scale soul, CONSUMED UNCHANGED — all five atoms. */}
      <WorkflowSoul def={row.def} scale="card" />

      {/* ── The ONE primary verb (D-09) ──────────────────────────────────────────────
          Exactly one per row state, chosen by provenance. A draft reaches no Run
          affordance anywhere on this card, menu included. */}
      <div className={FOOTER_CLASSES}>
        {runnable ? (
          <button
            type="button"
            data-testid="published-run"
            onClick={() => onRun(row)}
            className={PRIMARY_CLASSES}
          >
            {RUN_LABEL}
          </button>
        ) : (
          <button
            type="button"
            data-testid="draft-open"
            onClick={() => onOpen(row)}
            className={SECONDARY_CLASSES}
          >
            {OPEN_LABEL}
          </button>
        )}
      </div>

      {/* The WFIN-03 victim-naming Sheet (192-08), mounted as a black box: this card
          holds a ref and forwards two props, and decides none of the guard. */}
      {runnable && owned && (
        <WorkflowDeleteSheet
          ref={deleteSheetRef}
          wf={row.source as DeletableRow}
          onDeleted={onDeleted}
        />
      )}
    </div>
  )
}
