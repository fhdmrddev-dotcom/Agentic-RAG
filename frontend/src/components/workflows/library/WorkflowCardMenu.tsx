/**
 * Phase 286-04 (REG-07 / D-08), 2026-10-18 — THE CARD'S `⋯` OVERFLOW MENU AND ITS ARMED-DELETE
 * STATE MACHINE, MOVED VERBATIM OUT OF `WorkflowCard.tsx`.
 *
 * This is the seam the hot-file ledger named three times for `WorkflowCard.tsx`. The menu and the
 * draft's arm-to-confirm delete were the card's ONLY local state; they leave together, so the
 * card is left drawing its face and nothing else (Phase 290's re-skin edits a drawing-only file).
 *
 * ── WHAT IS HERE (three exports, because the menu and the prompt render in DIFFERENT places) ──
 *   · `useDraftDelete(row, onDeleted)` — D-18's three `useState` lines and `confirmDeleteDraft`,
 *     byte-identical, docblocks included. It returns the setters too, so the two inline arrows
 *     that call `setDeleteFailed` / `setArmed` came across unchanged.
 *   · `WorkflowCardMenu` — the `<DropdownMenu>` JSX, byte-identical, every comment included. The
 *     card mounts it in its top-right slot.
 *   · `DraftDeletePrompt` — the `{armed && (…)}` block, byte-identical. The card mounts it after
 *     the footer, which is where it always rendered.
 * The JSX keeps the INDENTATION it had in the card, so a byte compare of the moved spans against
 * the base proves the move rather than a reader's eye.
 *
 * ── WHAT STAYS IN THE CARD, AND WHY ──────────────────────────────────────────────────────────
 *   · The victim-naming Sheet's MOUNT, its ref and its import. `PublishedCardDelete.test.tsx`
 *     pins that import edge in the CARD's source (one host, a real edge, no shim), and the menu
 *     only asks the Sheet to open through the ref it is handed.
 *   · `owned` and `runnable`. Both are face decisions: `runnable` comes back from `cardFace`, and
 *     `owned` is the card's one read of the shipped ownership predicate. A second derivation here
 *     would be the drift D-03 forbids by name, so the menu receives both as props.
 *   · The top-right wrapper `<div>` and its `showOverflow` guard — that is card layout.
 *
 * ⚠ THE SLUG-WIDE DELETE CLIENT AND ITS PREVIEW CLIENT ARE DESCRIBED HERE, NEVER SPELLED, for the
 * reason the moved D-18 docblock below gives: the check that proves this subtree never reaches
 * them is a raw source count, and prose naming them would satisfy it. This module calls only the
 * single-draft endpoint, from the same `@/lib/api` specifier the card used, so a test's
 * `vi.mock("@/lib/api")` still intercepts it.
 *
 * ⚠ THIS MODULE JOINED `librarySubtree.fences.test.ts`'s explicit path list IN THE SAME COMMIT
 * THAT CREATED IT — an unlisted module is swept by nothing at all.
 */
import { useState, type RefObject } from "react"
import { CalendarClock, History, Loader2, MoreHorizontal, Trash2 } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  // 192.2-11 (WR-03). The shipped primitive that carries `role="group"` — one of the five
  // children ARIA permits inside `role="menu"`, which a `<p>` is not. ⚠ NOT
  // `DropdownMenuLabel`, and the reason is measured; see the ⚠ paragraph at its use site.
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { deleteWorkflowDraft } from "@/lib/api"

import { FORK_CONSEQUENCE, FORK_CONSEQUENCE_EXISTING, FORK_VERB } from "./libraryVocabulary"
import type { LibraryRow } from "./libraryRow"
import type { WorkflowDeleteSheetHandle } from "./WorkflowDeleteSheet"

// ── The menu's words and classes (moved verbatim from WorkflowCard.tsx, 286-04) ──────────

/**
 * The heaviest guard's trigger word, verbatim (`WorkflowsPage.tsx:834`). The ellipsis is
 * load-bearing vocabulary in this codebase: it promises a further step, and the further step
 * really is there — the victim-naming Sheet.
 */
const DELETE_WORKFLOW_LABEL = "Delete workflow…"

/**
 * SEED-190 — the read-only door's word.
 *
 * ⚠ NO ELLIPSIS, and the asymmetry with `DELETE_WORKFLOW_LABEL` directly above is the same
 * one `DELETE_DRAFT_LABEL` documents: an ellipsis in this codebase promises a further STEP
 * before anything happens. This item navigates immediately and asks nothing, so it earns none.
 *
 * ⚠ IT IS A NOUN, NOT A VERB, and every other item in this menu is a verb. That is deliberate:
 * the verbs here fork and delete, and a person scanning the menu should be able to see at a
 * glance that this one does neither. It also matches what the destination calls itself, so
 * clicking it lands on a screen whose heading is the word you clicked.
 */
const RUN_LOG_LABEL = "Run log"
// Phase 204 (SCHED-01). Sited beside RUN_LOG_LABEL and following its precedent exactly: a
// card-local constant, because that is where this card already keeps its own menu words.
const SCHEDULE_LABEL = "Schedules…"

/**
 * D-18's word for a draft. NO ellipsis, and the asymmetry is the point: this guard is one
 * extra click IN PLACE, not a Sheet, so an ellipsis promising a further surface would
 * overstate it. The vocabulary has to keep meaning what it means.
 */
const DELETE_DRAFT_LABEL = "Delete"

/**
 * The armed prompt. It names the victim's KIND and the irreversibility, and it names NO
 * COUNT — the `CapabilityGrid.tsx:15-21` honesty rule: no preview is fetched here, and a
 * fabricated number is worse than no number.
 */
const DELETE_DRAFT_PROMPT = "Delete this draft? It cannot be recovered."
const DELETE_DRAFT_CONFIRM = "Delete draft"
const DELETE_DRAFT_CANCEL = "Cancel"

/** Never silent (D-18). A guard that fails quietly is a guard that lies about succeeding. */
const DELETE_DRAFT_FAILED = "Couldn't delete this draft — try again."

/**
 * Phase 192.2-05 — the consequence sentence's classes, IN ITS NEW HOME.
 *
 * ⚠ IT WAS `NOTE_CLASSES` (`text-[11.5px] leading-snug text-muted-foreground`) on a card-level
 * paragraph. The size and leading are carried over verbatim — the sentence did not change, only
 * where it is spent — and the padding is the menu's own item padding, so the note sits on the
 * same left edge as the verb it describes rather than floating in the popover.
 */
const MENU_NOTE_CLASSES = "px-2 py-1.5 text-[11.5px] leading-snug text-muted-foreground"

/**
 * THE DESTRUCTIVE WEIGHT LIVES ON THE DELETE ITEMS AND NOWHERE ELSE ON THIS CARD — the
 * 146-148 rule stated at `WorkflowsPage.tsx:813-815`. A second control wearing it would make
 * the weight mean "an action" rather than "an action you cannot undo".
 */
const DESTRUCTIVE_ITEM_CLASSES = "text-destructive focus:text-destructive"

// ── D-18's armed-delete state machine (moved verbatim from the card's body, 286-04) ──────

/**
 * Phase 286-04 — the card's draft-delete state and its one async action, as a hook so the card
 * can hand the pieces to the TWO places that render them (the menu item arms; the prompt after
 * the footer confirms or cancels). The body below is the card's, byte-identical.
 */
// eslint-disable-next-line react-refresh/only-export-components -- a hook that drives the two components beside it; the threadNavigation.tsx precedent
export function useDraftDelete(row: LibraryRow, onDeleted: () => void) {
  /**
   * D-18's guard state — `MaintenancePanel.tsx:42-44`'s shipped arm-to-confirm, verbatim in
   * shape: THE FIRST CLICK ARMS AND DOES NOT DELETE, Confirm deletes, Cancel disarms. A
   * single stray click never reaches the endpoint.
   */
  const [armed, setArmed] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteFailed, setDeleteFailed] = useState(false)

  /**
   * D-18 — the single-draft endpoint, and NEVER the cascade pair. The cascade client and its
   * preview client resolve a SLUG and destroy every version under it, which for one draft
   * destroys far more than the person asked for. Both are reachable from this card only
   * THROUGH the Sheet, which is the only place their semantics are correct — so their
   * identifiers are described here rather than spelled, because the check that proves this
   * module never reaches them is a raw source count that prose would satisfy (the trap
   * `192-08` recorded on the page and `192-06` recorded before that).
   *
   * The row does not leave the list until the server confirms — `onDeleted` re-fetches, and
   * nothing here vanishes optimistically (the D-LOCK-04 rule the Sheet also honours).
   */
  async function confirmDeleteDraft() {
    if (deleting) return
    setDeleting(true)
    setDeleteFailed(false)
    try {
      await deleteWorkflowDraft(row.id)
      setArmed(false)
      onDeleted()
    } catch {
      setDeleteFailed(true)
    } finally {
      setDeleting(false)
    }
  }

  return { armed, setArmed, deleting, deleteFailed, setDeleteFailed, confirmDeleteDraft }
}

// ── The `⋯` menu ─────────────────────────────────────────────────────────────────────────

export interface WorkflowCardMenuProps {
  row: LibraryRow
  /** `cardFace`'s single answer to *can this be launched*, resolved in the card. */
  runnable: boolean
  /** The card's one read of the ownership predicate, resolved in the card. */
  owned: boolean
  hasExistingFork: boolean
  onRunLog?: (scope: { slug: string; name: string }) => void
  onSchedule?: (scope: { id: string; name: string }) => void
  onForkNewVersion: (row: LibraryRow) => void
  onForkStarter: (row: LibraryRow) => void
  /** The card's handle on the victim-naming Sheet it mounts. The menu only asks it to open. */
  deleteSheetRef: RefObject<WorkflowDeleteSheetHandle | null>
  setArmed: (armed: boolean) => void
  setDeleteFailed: (failed: boolean) => void
}

export function WorkflowCardMenu({
  row,
  runnable,
  owned,
  hasExistingFork,
  onRunLog,
  onSchedule,
  onForkNewVersion,
  onForkStarter,
  deleteSheetRef,
  setArmed,
  setDeleteFailed,
}: WorkflowCardMenuProps) {
  /**
   * D-13 / D-14 — the id of the one consequence sentence, derived from the ROW id. That
   * shape is the page's own precedent, not an invention: `WorkflowDeleteSheet.tsx:126`
   * builds `wf-delete-${wf.id}` the same way, and RESEARCH measured it as the only
   * `aria-describedby` the shipped page had.
   */
  const consequenceId = `wf-fork-${row.id}`

  return (
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
                {/* ── SEED-190 — THE DOOR TO THIS WORKFLOW'S RUNS ───────────────────
                    FIRST in the menu, and above every other item, because it is the only
                    item here that READS. Everything below it forks or deletes; a
                    read-only door sitting under two delete grades reads as though it
                    belonged to them.

                    ⚠ IT IS OFFERED ON EVERY ROW STATE, INCLUDING DRAFTS, and that is a
                    decision rather than an oversight. D-09's "a draft reaches no Run
                    affordance anywhere on this card" is about STARTING a run — this
                    starts nothing. A draft CAN have runs (measured 2026-08-20: 21 of 230
                    runs point at a draft definition), so hiding the door there would hide
                    real history behind a rule written about a different verb.

                    ⚠ IT IS A `DropdownMenuItem`, WHICH IS WHAT KEEPS WR-03 GREEN.
                    `aria-required-children` permits only menuitem / menuitemradio /
                    menuitemcheckbox / group / separator as direct children of
                    `role="menu"`, and this card's suite sweeps exactly those five roles
                    over the open menu's element children. */}
                {onRunLog && (
                  <DropdownMenuItem
                    data-testid="workflow-run-log"
                    onClick={() => onRunLog({ slug: row.slug, name: row.name })}
                  >
                    <History className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                    {RUN_LOG_LABEL}
                  </DropdownMenuItem>
                )}

                {/* ── Phase 204 (SCHED-01) — THE DOOR TO THIS WORKFLOW'S SCHEDULES ──
                    Second, directly under the run log, because those two are the menu's
                    only non-destructive items and they belong together above the forks
                    and the deletes.

                    ⚠ PUBLISHED ROWS ONLY (see the prop's docblock): the API refuses a
                    draft, so offering it on one would be an affordance that exists only
                    to be refused.

                    ⚠ IT IS A `DropdownMenuItem`, WHICH IS WHAT KEEPS WR-03 GREEN — the
                    suite sweeps the five `aria-required-children` roles over this menu's
                    element children, and anything else here turns that green red. */}
                {onSchedule && row.provenance === "published" && (
                  <DropdownMenuItem
                    data-testid="workflow-schedules"
                    onClick={() => onSchedule({ id: row.id, name: row.name })}
                  >
                    <CalendarClock className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                    {SCHEDULE_LABEL}
                  </DropdownMenuItem>
                )}

                {/* ── The fork: ONE WORD, TWO FUNCTIONS (D-12) ──────────────────────
                    Both items carry the same label and route to DIFFERENT handlers.
                    Exactly one of them is reachable on any given row. */}
                {row.provenance === "published" && (
                  <DropdownMenuItem
                    data-testid="published-tweak"
                    aria-describedby={consequenceId}
                    onClick={() => onForkNewVersion(row)}
                  >
                    {FORK_VERB}
                  </DropdownMenuItem>
                )}
                {row.provenance === "starter" && (
                  <DropdownMenuItem
                    data-testid="use-starter"
                    aria-describedby={consequenceId}
                    onClick={() => onForkStarter(row)}
                  >
                    {FORK_VERB}
                  </DropdownMenuItem>
                )}

                {/* The heaviest guard's trigger — the ONLY control on this card that
                    wears destructive weight. It merely ASKS the Sheet to open. */}
                {runnable && owned && (
                  <DropdownMenuItem
                    data-testid="published-delete"
                    className={DESTRUCTIVE_ITEM_CLASSES}
                    onClick={() => deleteSheetRef.current?.openDeleteSheet()}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                    {DELETE_WORKFLOW_LABEL}
                  </DropdownMenuItem>
                )}

                {/* ── D-18: the LIGHTER grade, and lighter by a measurable amount ────
                    The published row's guard fetches exact server counts, names its
                    victim and drives an in-place lifecycle. A draft has no published
                    history, no runs and no threads to destroy, so it earns the middle
                    grade instead: one extra click, no fetch. This item ARMS. */}
                {!runnable && (
                  <DropdownMenuItem
                    data-testid="draft-delete"
                    className={DESTRUCTIVE_ITEM_CLASSES}
                    onClick={() => {
                      setDeleteFailed(false)
                      setArmed(true)
                    }}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                    {DELETE_DRAFT_LABEL}
                  </DropdownMenuItem>
                )}

                {/* ── THE ONE SENTENCE THIS SURFACE SPENDS (D-13 / D-14) ────────────
                    Real DOM text, wired to the fork control by `aria-describedby` — so
                    the explanation reaches a touch user and a screen reader alike, which
                    the hover-only tooltip it replaces never did. It names BOTH halves:
                    what you get, and what stays true. Naming only the first half
                    reproduces the exact surprise LIB-03 exists to end, which is why the
                    sentence is imported rather than typed.

                    ⚠ 192.2-05 (D-03, threat T-21): IT MOVED HERE FROM THE RESTING CARD,
                    AND MOVING IS NOT DELETING. D-03 cuts it from the resting card — it was
                    a two-line paragraph on every runnable row, i.e. most of the shelf — but
                    it warns about a real consequence before a real act, so it is spent at
                    the MOMENT IT IS NEEDED instead: in the menu, directly under the verb it
                    describes, where the person is when the warning is worth anything. The
                    `aria-describedby` round trip is unchanged and still asserted.

                    ⚠ IT IS NOT A MENU ITEM — AND THE ORIGINAL REASONING FOR THAT WAS
                    CORRECT BUT INSUFFICIENT, WHICH IS WHY IT IS AMENDED HERE RATHER THAN
                    REPLACED. It said: *"A plain `<p>` inside the content carries no role,
                    takes no focus and is skipped by Radix's roving focus and typeahead, so
                    the menu still offers exactly the actions it offered."* Every clause of
                    that is true, and **that property still holds with `DropdownMenuLabel`**
                    — the label is equally unfocusable and equally skipped, so nothing about
                    the menu's offered ACTIONS changes.

                    What it missed is a different contract (WR-03): ARIA's
                    `aria-required-children` requires the children of `role="menu"` to be
                    `menuitem` / `menuitemradio` / `menuitemcheckbox` / `group` /
                    `separator`, and a raw `<p>` is NONE of them — so the menu was
                    MISDESCRIBED to assistive technology even though it behaved correctly
                    for a sighted mouse user.

                    ⚠ THE FIX IS `DropdownMenuGroup`, **NOT** `DropdownMenuLabel`, AND THE
                    CHANGE OF PRIMITIVE IS MEASURED RATHER THAN PREFERRED. Both the review's
                    fix block and this plan's DEC-11-E named `DropdownMenuLabel` as *"the same
                    visual node with a valid role"*. **Both halves of that are false**, and
                    each was checked rather than argued:

                      · IT CARRIES NO ROLE AT ALL. Radix's `Menu.Label` is a bare
                        `Primitive.div` with no `role` prop
                        (`@radix-ui/react-menu/dist/index.mjs:356-362`), so swapping to it left
                        the five-role sweep still RED — `div[role=none]` where it had said
                        `p[role=none]`. That is a renamed defect, not a fixed one.
                      · IT IS NOT THE SAME VISUAL NODE. `DropdownMenuLabel` merges
                        `"px-2 py-1.5 text-sm font-semibold"` UNDER our `className`, and
                        `MENU_NOTE_CLASSES` names no font weight — so the note would have
                        rendered SEMIBOLD, a pixel change D-03 did not sanction on a card this
                        phase exists to quieten.

                    `Menu.Group` renders `role="group"` and nothing else
                    (`index.mjs:348-354`), so this is ONE node, a permitted role, and the
                    identical paint. It is also exactly the review's own parenthetical
                    alternative — wrap it in a `role="group"` — reached through the
                    shipped primitive instead of a hand-rolled div.

                    ⚠ THE `aria-describedby` ROUND TRIP IS UNCHANGED AND STILL ASSERTED:
                    `id`, `data-testid` and `className` all move across verbatim, so the two
                    fork items still resolve to this node and its existing round-trip cases
                    pass UNEDITED.

                    ⚠ AND AXE DID NOT CATCH THIS — measured, not assumed. `vitest-axe`
                    (axe-core 4.11.4) over the REAL open menu, opened by driving the trigger,
                    passed GREEN against the `<p>` under jsdom; `aria-required-children` never
                    fired. So the fence that actually holds WR-03 is the explicit five-role
                    sweep over the menu's direct element children in `WorkflowCard.test.tsx`,
                    which was driven RED twice — once on the `<p>` and once on the
                    `DropdownMenuLabel` attempt — and named the offending node both times.

                    ⚠ 192-13: WHICH sentence depends on the row's real state. On a row the
                    person has already forked, the verb opens their EXISTING draft and
                    creates nothing, so promising "a new private copy" there would be a quiet
                    lie. STILL EXACTLY ONE NODE: the sentence is selected, never appended. */}
                {runnable && (
                  <DropdownMenuGroup
                    id={consequenceId}
                    data-testid="fork-consequence"
                    className={MENU_NOTE_CLASSES}
                  >
                    {hasExistingFork ? FORK_CONSEQUENCE_EXISTING : FORK_CONSEQUENCE}
                  </DropdownMenuGroup>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
  )
}

// ── D-18's armed prompt ──────────────────────────────────────────────────────────────────

export interface DraftDeletePromptProps {
  armed: boolean
  deleting: boolean
  deleteFailed: boolean
  setArmed: (armed: boolean) => void
  confirmDeleteDraft: () => Promise<void>
}

export function DraftDeletePrompt({
  armed,
  deleting,
  deleteFailed,
  setArmed,
  confirmDeleteDraft,
}: DraftDeletePromptProps) {
  return (
    <>
      {/* ── D-18's armed prompt — the deliberate SECOND step ─────────────────────────
          `MaintenancePanel.tsx:100-131`'s shipped shape. It appears only once the menu
          item has armed it, it states the consequence in words and NO COUNT, and a
          failure is said out loud rather than swallowed. */}
      {armed && (
        <div
          data-testid="draft-delete-prompt"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5"
        >
          <p className="text-[13px] font-medium text-foreground">{DELETE_DRAFT_PROMPT}</p>
          <div className="mt-2.5 flex items-center justify-end gap-2">
            <button
              type="button"
              data-testid="draft-delete-cancel"
              onClick={() => setArmed(false)}
              disabled={deleting}
              className="rounded-md border border-border px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-60"
            >
              {DELETE_DRAFT_CANCEL}
            </button>
            <button
              type="button"
              data-testid="draft-delete-confirm"
              onClick={confirmDeleteDraft}
              disabled={deleting}
              className={
                "inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-[13px] font-semibold text-destructive-foreground transition-colors hover:opacity-90 disabled:opacity-60"
              }
            >
              {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              {DELETE_DRAFT_CONFIRM}
            </button>
          </div>
          {deleteFailed && (
            <p data-testid="draft-delete-error" role="status" className="mt-2 text-[11.5px] text-destructive">
              {DELETE_DRAFT_FAILED}
            </p>
          )}
        </div>
      )}
    </>
  )
}
