/**
 * Phase 192-08 Task 1 (D-01) — WorkflowDeleteSheet.
 *
 * THE WFIN-03 VICTIM-NAMING DELETE SHEET — the HEAVIEST of the three shipped action-guard
 * grades (`192-PATTERNS.md` § S-5, the recorded 146-148 rule that grades a guard BY
 * CONSEQUENCE). It fetches the EXACT server counts BEFORE offering the destructive action,
 * names the victim, raises the amber cancel-first banner only when a run is live, and drives
 * an in-place lifecycle with NO optimistic vanish and NO undo. Two other live decisions are
 * arguments made BY REFERENCE to this guard — D-15 (the fork ships no confirm sheet, because
 * a heavy guard on a harmless action spends the vocabulary THIS one relies on) and D-18 (the
 * draft delete must be demonstrably LIGHTER than this) — so both become false the moment this
 * one quietly weakens. That is why the two invariant comments below travelled byte-for-byte
 * rather than being re-typed: they are the written record of the guard's reasons.
 *
 * ── STATE OF THE EXTRACTION (read literally; not a claim about the future) ──
 * This Sheet was CUT out of `WorkflowsPage.tsx`, where it lived inside `PublishedCard` — the
 * component D-01 deletes. It is a HARD CUT: the page declares neither `DeletePhase` nor this
 * component any more, and NO re-export shim was left behind. The page imports the component
 * from here and mounts it at the byte-identical JSX site, forwarding `wf` and `onDeleted`.
 *
 * ── THE MEASURED EXTENT: 175 LINES ACROSS FOUR SPANS, NOT THE 132-LINE JSX RANGE ──
 * `192-CONTEXT.md` scopes this move at the JSX range alone. A cut of only that range READS
 * self-contained and is not: the block closes over state declared ~100 lines above it, inside
 * the component being deleted. Re-derived here with `grep -n` against the wave-3 base
 * `899cfeb1`, where the page measures 1068 L (NOT the 1407 every inherited document quotes —
 * `192-06` already cut the Run modal out, shifting every line number in this move by +14):
 *
 *   :755-757     3 L   the lifecycle docblock + `type DeletePhase`
 *   :770-773     4 L   the `onDeleted` prop + its D-LOCK-04 docblock — the re-fetch seam
 *   :778-813    36 L   the WFIN-03 surface comment, the five hooks + `descId`,
 *                      `openDeleteSheet` (fetches the preview) and `handleDelete`
 *   :886-1017  132 L   the `<Sheet>` JSX (comment from :886, element from :891)
 *                      ─────
 *                       175 L
 *
 * ⚠ `192-04-SUMMARY.md` measured this extent as **169** and named four spans. Re-derived at
 * this base it is **175**, and the difference is NOT a disagreement about which code moves —
 * it is two COMMENT BLOCKS that document the moved code and were outside 192-04's span list:
 * the 2-line lifecycle docblock above `type DeletePhase`, and the 4-line `── WFIN-03 delete
 * surface ──` block above the hooks. Both describe this Sheet and nothing else, so leaving
 * them on a page that no longer contains the Sheet would strand the explanation away from the
 * code. 169 + 2 + 4 = 175. The SPANS are what a later reader should inherit, never the number.
 *
 * ⚠ THE `:NNN` REFERENCES INSIDE THE MOVED COMMENTS POINT AT THE PRE-MOVE `WorkflowsPage.tsx`,
 * not at this file and not at the page as it now stands. Kept exactly as shipped: rewriting
 * them would be an EDIT, and this has to read as a move.
 *
 * ── WHY AN IMPERATIVE HANDLE AND NOT A CONTROLLED `open` / `onOpenChange` PAIR ──
 * The plan left the opening mechanism open and required the choice to be stated. A controlled
 * pair would leave `sheetOpen` declared on the caller — and `192-PATTERNS.md` § 2 names exactly
 * that as *the version of this move that looks verbatim and is not*: a guard whose state stays
 * behind is not moved, it is SPLIT. Worse, `192-09` rewrites the card, so a split would hand
 * that plan a piece of this guard to re-implement. So this component owns ALL FIVE state hooks,
 * `descId` and both handlers, and the caller receives only a way to ASK it to open. React 19
 * passes `ref` as an ordinary prop, so no `forwardRef` wrapper is needed. The alternative the
 * plan also offered — exporting a `useWorkflowDelete` hook — was rejected on a measured rule
 * rather than taste: `react-refresh/only-export-components` forbids a component module from
 * exporting a runtime non-component, which is the same rule that put `libraryFilter.ts` and
 * `libraryVocabulary.ts` in leaves of their own, and the artifact contract for this plan names
 * `WorkflowDeleteSheet` as the export.
 *
 * THIS FILE EXPORTS THE COMPONENT AND TWO TYPES AND NO OTHER RUNTIME VALUE OF ANY KIND.
 *
 * ── WHAT IS ALREADY WATCHING THIS FILE ──
 * `librarySubtree.fences.test.ts` (192-05) named `./WorkflowDeleteSheet.tsx` in its explicit
 * seven-path list BEFORE this file existed, so four fences began reading it the moment it
 * landed, with no edit to the fence: F1 (no hover-only explanation — D-14, touch has no hover;
 * this Sheet's `aria-describedby`/`descId` pair is the page's OWN precedent for that rule and
 * it moved with the code), F4 (this module may name no `WorkflowsPage` specifier in any import
 * form — a back-import typechecks clean, lints clean, and fails only at runtime), F5 (no
 * user-visible string overstating the search) and T-192-04 (no raw-HTML escape hatch — that
 * fence is a RAW regex rather than a parsed one, so it reds on prose that merely SPELLS the
 * React prop it forbids; this sentence deliberately does not, per `192-06`'s deviation 2).
 *
 * And `PublishedCardDelete.test.tsx` holds SEVEN whole-`innerHTML` captures plus the two
 * graded-guard invariants, taken by `192-04` at `14b309b4` — a commit at which this very path
 * answered *"does not exist in 'HEAD'"*. Those literals are CAPTURES, not expectations: a red
 * one means this move was not verbatim, and re-capturing to make it green deletes the only
 * evidence the Sheet still refuses what it refused.
 */
import { useState, useImperativeHandle, type Ref } from "react"
import { AlertTriangle, Check, Loader2 } from "lucide-react"

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  getWorkflowDeletePreview,
  deleteWorkflowCascade,
  type PublishedWorkflow,
  type WorkflowDeletePreview,
} from "@/lib/api"

/** The in-place delete lifecycle (D-LOCK-04), adapting the 064-B KillPhase machine:
 *  idle → deleting (Deleting…) → deleted (Deleted · recorded) | error (Try again). */
type DeletePhase = "idle" | "deleting" | "deleted" | "error"

/**
 * The one thing the caller may ask of this component. `openDeleteSheet` is the SHIPPED name
 * of the handler (`WorkflowsPage.tsx:788-800` before the move), kept so the card's menu item
 * still reads `openDeleteSheet` at the call site — the trigger wording did not change, only
 * where the function lives.
 */
export interface WorkflowDeleteSheetHandle {
  openDeleteSheet: () => void
}

export interface WorkflowDeleteSheetProps {
  wf: PublishedWorkflow
  /** 152-04 (WFIN-03): re-fetch the Published shelf after a CONFIRMED cascade delete —
   *  the card leaves the list ONLY on server confirmation (D-LOCK-04: no optimistic
   *  vanish, no undo; hard-delete is irreversible). */
  onDeleted: () => void
  /** The caller's way to ASK the Sheet to open. Everything else about the guard — whether it
   *  MAY close, and when the row is allowed to leave the list — is decided in here. */
  ref?: Ref<WorkflowDeleteSheetHandle>
}

export function WorkflowDeleteSheet({ wf, onDeleted, ref }: WorkflowDeleteSheetProps) {
  // ── WFIN-03 delete surface (D-LOCK-03/04/05). The ⋯-menu opens a victim-naming
  //    confirm Sheet (the shipped 064-B / ActiveRunsSection primitive): it names the
  //    EXACT server counts (Removed vs Kept), shows an amber cancel-first banner when a
  //    run is live, and transitions the card in place — never an optimistic vanish. ──
  const [sheetOpen, setSheetOpen] = useState(false)
  const [preview, setPreview] = useState<WorkflowDeletePreview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [deletePhase, setDeletePhase] = useState<DeletePhase>("idle")
  const descId = `wf-delete-${wf.id}`

  const openDeleteSheet = () => {
    // Fresh state each open, then fetch the EXACT server counts BEFORE offering the
    // destructive action — the sheet never renders placeholder/guessed counts (D-LOCK-03).
    setPreview(null)
    setPreviewError(null)
    setDeletePhase("idle")
    setSheetOpen(true)
    getWorkflowDeletePreview(wf.id)
      .then(setPreview)
      .catch((e) =>
        setPreviewError(e instanceof Error ? e.message : "Couldn’t load the delete preview"),
      )
  }

  const handleDelete = async () => {
    setDeletePhase("deleting")
    try {
      await deleteWorkflowCascade(wf.id)
      setDeletePhase("deleted")
      // Server-confirmed: re-fetch the shelf so the card leaves the list ONLY now
      // (D-LOCK-04 — the list is never filtered locally / optimistically).
      onDeleted()
    } catch {
      setDeletePhase("error")
    }
  }

  // Recomputed every render (no dependency array on purpose), so the handle can never hand
  // the caller a stale closure over an older `deletePhase` — which is the one way an
  // imperative handle could silently re-open a Sheet that is mid-delete.
  useImperativeHandle(ref, () => ({ openDeleteSheet }))

  return (
    <>
      {/* ── WFIN-03 victim-naming delete Sheet (D-LOCK-03/04/05 — the shipped 064-B /
            ActiveRunsSection bottom-sheet primitive). EXACT server-sourced Removed/Kept
            counts; an amber cancel-first banner ONLY when a run is live; an in-place
            lifecycle (Deleting… → Deleted · recorded) with NO optimistic vanish + NO undo.
            The single destructive-weighted control is Delete-forever. ── */}
      <Sheet
        open={sheetOpen}
        onOpenChange={(o) => {
          // Never dismiss mid-delete (the action is in flight). A confirmed delete stays
          // open on its terminal state until the shelf re-fetch unmounts the card.
          if (!o && deletePhase === "deleting") return
          setSheetOpen(o)
        }}
      >
        <SheetContent side="bottom" aria-describedby={descId} className="mx-auto max-w-lg">
          <SheetHeader>
            <SheetTitle>Delete this workflow?</SheetTitle>
          </SheetHeader>
          <div id={descId} className="px-4 pb-4">
            {previewError ? (
              <div>
                <p role="alert" className="text-sm text-destructive">
                  {previewError}
                </p>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSheetOpen(false)}
                    className="h-10 rounded-md border border-border px-4 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    Keep it
                  </button>
                </div>
              </div>
            ) : preview === null ? (
              // ── PORTED FROM SKETCH 200 `fork-delete.html` §2, LOADING SPECIMEN ─────────
              // The sheet draws this moment as a SPINNER beside the title with the line
              // *"Checking what this will remove…"*, and the whole card at `opacity-70`.
              // Two things it gets right that the shipped line did not: a spinner says the
              // wait is alive rather than stuck, and "checking what this will remove" says
              // WHY there is a wait — the guard is fetching the exact victim before it will
              // offer the button (D-LOCK-03). "Loading the exact counts…" named the
              // mechanism, which is the thing this design language does not print.
              // ⚠ `role="status"` and the never-guess rule are untouched: this arm still
              // renders NO count, no placeholder and no destructive control.
              <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 flex-none animate-spin" aria-hidden="true" />
                Checking what this will remove…
              </p>
            ) : (
              <>
                {/* ── PORTED FROM SKETCH 200 `fork-delete.html` §2, LOADED SPECIMEN ───────
                    The victim group becomes a quiet uppercase caption over a RAISED BOX
                    holding the name on its own line and the counts beneath it. Two lines,
                    not one run-on sentence — the name is what a person checks, and it was
                    competing with two numbers on the same baseline.

                    ⚠ THE CAPTION LOSES ITS RED, AND THAT IS THE SHEET'S OWN RULE RATHER
                    THAN A SOFTENING. §3's table reads *"spends danger colour: yes, ON THE
                    BUTTON ONLY"*. Red on the caption spent the strongest signal this
                    surface has on a label, so the one control that is actually irreversible
                    had to shout over it. `Delete forever` keeps `bg-destructive` and is now
                    the only red thing in the dialog.

                    ⚠ EVERY OTHER LADDER RULE IS UNCHANGED AND STILL ASSERTED: the victim is
                    named, the EXACT server counts are stated before the button exists, and
                    the audit receipt is rendered. This is a re-presentation of the heaviest
                    guard, never a de-grading of it. */}
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    Permanently removed
                  </p>
                  <p className="mt-1.5 flex flex-col gap-0.5 rounded-md border border-border bg-muted/40 p-4">
                    <span className="text-sm font-medium text-foreground">{preview.name}</span>
                    <span className="text-[12px] text-muted-foreground">
                      {preview.versions} versions · {preview.runs} run records
                    </span>
                  </p>
                </div>
                {/* Kept group — neutral caption + the reassurance that closes "no orphaned
                    threads"; it ALWAYS renders (incl. the 0-threads variant). The sheet
                    boxes it too, transparently rather than raised, so the two groups read as
                    a pair and the weight difference between them is legible. */}
                <div className="mt-6">
                  <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    Kept — not touched
                  </p>
                  <p className="mt-1.5 rounded-md border border-border bg-transparent p-4 text-[12px] text-muted-foreground">
                    {preview.threads > 0
                      ? `${preview.threads} chat threads become normal chats — transcripts & files stay. Your knowledge base is untouched.`
                      : "No chat threads to keep."}
                  </p>
                </div>
                {/* Amber cancel-first banner — ONLY when a run is live (D-LOCK-05); amber,
                    never red (the graded action-guards rule). */}
                {preview.in_flight > 0 && (
                  <div
                    role="status"
                    data-testid="delete-inflight-banner"
                    className="mt-4 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[13px] text-amber-400"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
                    <span>
                      {preview.in_flight === 1
                        ? "1 run is still in progress. It’s cancelled safely first, then the workflow is deleted."
                        : `${preview.in_flight} runs are still in progress. They’re cancelled safely first, then the workflow is deleted.`}
                    </span>
                  </div>
                )}
                {/* Action row / in-place lifecycle (adapts the 064-B KillPhase terminals). */}
                <div className="mt-5 flex items-center justify-end gap-2">
                  {deletePhase === "idle" && (
                    <>
                      <button
                        type="button"
                        onClick={() => setSheetOpen(false)}
                        className="h-10 rounded-md border border-border px-4 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        Keep it
                      </button>
                      {/* THE ONLY RED THING IN THIS DIALOG (sketch 200 §3 — *"spends danger
                          colour: yes, on the button only"*). Unchanged apart from the
                          sheet's `h-10` sizing. */}
                      <button
                        type="button"
                        data-testid="delete-forever"
                        onClick={() => void handleDelete()}
                        className="h-10 rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
                      >
                        Delete forever
                      </button>
                    </>
                  )}
                  {deletePhase === "deleting" && (
                    <span role="status" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Deleting…
                    </span>
                  )}
                  {deletePhase === "deleted" && (
                    <span role="status" className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <Check className="h-4 w-4 text-success" aria-hidden="true" />
                      Deleted · recorded
                    </span>
                  )}
                  {deletePhase === "error" && (
                    <div className="flex items-center gap-2">
                      <span role="status" className="text-sm text-destructive">
                        Couldn’t delete the workflow
                      </span>
                      <button
                        type="button"
                        data-testid="delete-retry"
                        onClick={() => void handleDelete()}
                        className="inline-flex items-center rounded-md border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive transition-colors hover:bg-destructive/20"
                      >
                        Try again
                      </button>
                    </div>
                  )}
                </div>
                {/* Recorded footer — the audit receipt honesty (D-LOCK-03). The sheet sets
                    it right-aligned and italic, under the action row: a receipt, read after
                    the decision rather than argued before it.
                    ⚠ THE ✎ STAYS THOUGH THE SHEET DROPS IT. It is the shipped audit-receipt
                    mark (146-148 — *"✎ writes"*), it is the same glyph the Control Room's
                    ledger spends, and dropping it here would fork that vocabulary for one
                    dialog. Nothing in the reference is REMOVED by keeping it. */}
                <p className="mt-4 text-right text-[12px] italic text-muted-foreground">
                  ✎ Recorded with your name in the audit log.
                </p>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
