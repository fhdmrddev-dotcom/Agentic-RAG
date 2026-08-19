/**
 * Phase 192.1-07 Task 1 (LIB-05 — D-14 / D-19 / D-20 / D-21 / D-36, threats T-192.1-19 /
 * T-192.1-20 / T-192.1-21 / T-192.1-22) — 162-B'S NAME PROMPT AT THE FORK.
 *
 * 43 of the operator's 104 workflows are called "Compliance Gap Report", because every fork
 * inherits its parent's name. The identity line (192.1-04…06) tells them apart on the READ
 * side; this is the WRITE-side answer that stops the pile growing.
 *
 * ── ⚠ THIS FILE REOPENS PHASE 192'S D-15, AND THE AMENDMENT SHIPS WITH IT (D-19) ────────
 *
 * 192 made the fork a DIRECT FLIP on a recorded argument — *a confirm on a non-destructive,
 * reversible action spends the guard vocabulary the delete relies on to mean anything*
 * (`CapabilityGrid.tsx:11-13`) — and deliberately did not ship 159-C's confirm. That
 * paragraph lives in `WorkflowCard.tsx`'s own docblock and is REWRITTEN in the same commit
 * as this file, because a decision left silently contradicted is worse than one reversed in
 * the open.
 *
 * **The rationale that makes this prompt legal is MECHANICAL rather than rhetorical: it
 * collects something the system cannot know, so it is an INPUT, not a guard — and inputs do
 * not spend guard vocabulary.** Each of D-19's four clauses is a test in
 * `ForkNameDialog.test.tsx`, not a sentiment in this comment:
 *
 *   1. it asks for a NAME, never for a confirmation — the field opens EMPTY (a prefilled
 *      name would be a confirmation wearing an input's clothes);
 *   2. its primary button is `Create my copy`, and the suite asserts *"the primary is NOT
 *      `Confirm`"* — that negative is what makes the distinction machine-checkable;
 *   3. it wears NO destructive styling — no `DESTRUCTIVE_ITEM_CLASSES`, no red, no victim
 *      naming (asserted over the rendered `outerHTML`, with a positive control);
 *   4. it WARNS AND NEVER BLOCKS on a colliding name (D-20).
 *
 * The graded-guard ladder (146-148) is therefore UNTOUCHED: the victim-naming sheet still
 * guards the live delete, arm-to-confirm still guards the draft delete, and the fork stays
 * OUTSIDE the ladder entirely. It is now an input step, not a lighter guard.
 *
 * ── D-20 — EMPTINESS IS THE ONLY HARD GATE ──────────────────────────────────────────────
 *
 * `disabled` is `empty`, and nothing else. A colliding name gets `FORK_HINT_CLASH` and a
 * working button, because *a name you chose is a name you are allowed to have; blocking
 * would make the library's problem the user's fault.* ⚠ The suite proves this by SUBMITTING
 * THROUGH the clash and reading the argument the callback received — asserting only that the
 * warning renders is satisfied identically by a dialog that warns and then refuses.
 *
 * ── D-36 — THE SHELL IS `ui/dialog.tsx`, AND IT IS NOT A CLONE OF `InviteMemberDialog` ───
 *
 * Two independent reasons, both recorded rather than assumed:
 *
 *   · **NOT `AlertDialog`.** Its three shipped consumers are all CONFIRMATIONS and it traps
 *     focus on a confirm/cancel pair, which is the wrong role for a text field. Reaching for
 *     the *alert* primitive would contradict D-19 in the component tree while the prose said
 *     otherwise — the wrong-pointer failure one layer below prose.
 *   · **NOT a clone of `org/InviteMemberDialog.tsx`.** It carries the F1-forbidden attribute
 *     TWICE (`:159`, `:228`), and inside `library/` either line reds F1 by construction the
 *     instant this file joins `LIBRARY_SUBTREE_PATHS`. `<DialogTitle>` is an ELEMENT and is
 *     safe; the same word as a JSX *prop* is not, and F1's scoping control covers only an
 *     object PROPERTY. That distinction is how the D-07 highlight got deferred; this is the
 *     second recorded instance. Its Dialog/label/footer wiring and its reset-on-open effect
 *     are what were copied — neither tooltip.
 *
 * `DialogDescription` is used for the sub-line, closing the gap `192.1-PATTERNS.md` names:
 * neither `InviteMemberDialog` nor `CreateLinkDialog` uses it, Radix warns when
 * `DialogContent` has no accessible description, and six other files in the repo do use it.
 *
 * ── D-14 — EVERY USER-VISIBLE STRING IS IMPORTED ────────────────────────────────────────
 *
 * Not one sentence is typed here. They come from `libraryVocabulary.ts`, which is where the
 * generated build contract's strings landed in 192.1-04, so a copy change stays a one-line
 * diff in ONE file and the sketch's anti-drift mechanism keeps working. `FORK_CONSEQUENCE`
 * in particular is the SHIPPED sentence the card already spends, rendered verbatim — never
 * reworded, and never joined by a second consequence sentence on this surface.
 *
 * ── THE THINGS THIS FILE DELIBERATELY DOES NOT DO ───────────────────────────────────────
 *
 *  - **It does not check for collisions itself.** `isClash` is passed IN, because the check
 *    is over the caller's own rows in the merged feed (D-21) and the page holds that list.
 *    Reaching for it here would put a second copy of the shipped ownership predicate in a
 *    component (D-09).
 *  - **It does not know what a fork IS.** It takes a source name and hands back a typed one;
 *    slug and version mechanics stay in `useWorkflowFork.ts`, where D-12 governs them.
 *  - **It renders the typed name nowhere as markup.** The name is user-controlled text
 *    (T-192.1-19); it travels back through a callback and reaches the DOM only as a JSX text
 *    node elsewhere, which React escapes. ⚠ React's raw-HTML escape hatch is DESCRIBED here
 *    rather than spelled, and that is not squeamishness: T-192-04's fence is a RAW regex over
 *    this file's source, so naming the prop in prose reds the guard that forbids it. Observed,
 *    not reasoned — the first draft of this paragraph spelled it and the fence failed with
 *    *"expected '/**\n * Phase 192.1-07 Task 1 (LIB-05…' not to match …"*. The 187-24 trap,
 *    which this subtree has now recorded four times.
 *  - **It does not use `autoFocus`.** `jsx-a11y/no-autofocus` is an ERROR under the CI a11y
 *    config, so initial focus is placed in Radix's own `onOpenAutoFocus`, which is also the
 *    only hook that runs AFTER the primitive's own focus management.
 *
 * ⚠ THE IDS ARE MODULE-SCOPE CONSTANTS, NOT `useId`. This is a SINGLETON: the page mounts
 * exactly one prompt and gates it on `open`, so two instances cannot coexist and a generated
 * id would only make the `aria-describedby` round trip harder to assert. `InviteMemberDialog`
 * takes the same shape for the same reason. Should a second prompt ever mount concurrently,
 * this is the line that has to change.
 */
import { useRef, useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  FORK_CONSEQUENCE,
  FORK_DIALOG_CANCEL,
  FORK_DIALOG_OK,
  FORK_DIALOG_TITLE,
  FORK_HINT_CLASH,
  FORK_HINT_EMPTY,
  FORK_HINT_FREE,
  forkDialogSub,
} from "./libraryVocabulary"

const INPUT_ID = "fork-name-field"
const HINT_ID = "fork-name-field-hint"
const CONSEQUENCE_ID = "fork-name-field-consequence"

export interface ForkNameDialogProps {
  /** Mounted-and-visible. The page gates this on its pending fork; there is no internal open state. */
  open: boolean
  /** The row being copied. Named in the sub-line so the person knows WHAT they are naming. */
  sourceName: string
  /** Escape, Cancel, the ✕ and an overlay click all land here. Nothing is created. */
  onCancel: () => void
  /** The typed name, already trimmed. Called only when the name is non-empty. */
  onCreate: (name: string) => void
  /**
   * D-21's pre-flight, passed IN. It reads DISPLAY NAMES over the caller's own rows and it
   * is ADVISORY — it is not, and must never be presented as, a slug check, and it does not
   * retire WR-08's `UNIQUE(slug, version)` 409 (D-22).
   */
  isClash: (name: string) => boolean
}

export function ForkNameDialog({
  open,
  sourceName,
  onCancel,
  onCreate,
  isClash,
}: ForkNameDialogProps) {
  const [value, setValue] = useState("")
  const [openedWith, setOpenedWith] = useState(open)
  const inputRef = useRef<HTMLInputElement>(null)

  /**
   * Reset-on-open. A prompt that remembers the last name typed would offer it as a default,
   * which is a prefill by another route — and D-19's first clause is that this thing ASKS.
   *
   * ⚠ IT IS AN ADJUST-DURING-RENDER, NOT AN EFFECT, AND THAT WAS MEASURED RATHER THAN
   * PREFERRED. `InviteMemberDialog.tsx:85-100` does this in a `useEffect`, and copying that
   * shape here failed the scoped lint outright — `react-hooks/set-state-in-effect`, *"Calling
   * setState synchronously within an effect can trigger cascading renders"*, one new error
   * against a clean 0 baseline. React's own documented answer for "adjust state when a prop
   * changes" is this comparison in the render body: it re-renders before the browser paints,
   * so the field is never briefly non-empty, and no cascade is scheduled.
   */
  if (open !== openedWith) {
    setOpenedWith(open)
    if (open) setValue("")
  }

  const trimmed = value.trim()
  const empty = trimmed === ""
  const clash = !empty && isClash(trimmed)
  const hint = empty ? FORK_HINT_EMPTY : clash ? FORK_HINT_CLASH : FORK_HINT_FREE

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Radix routes Escape, the ✕ and the overlay click through here. All three mean
        // "not now", and none of them creates anything.
        if (!next) onCancel()
      }}
    >
      {/* ── PORTED FROM SKETCH 200 `fork-delete.html` §1 (2026-08-20) ───────────────────
          The sheet titles itself *"Two dialogs, deliberately unequal"* and its §3 table
          states the ladder as four rules. This dialog is the LIGHT end of that ladder and
          the port keeps it there — every delta below either matches the sheet or is a
          refusal recorded in writing:

            names what it affects   no  ·  states exact numbers first  no
            spends danger colour    no  ·  leaves a receipt            no

          What actually changed: the card widens to the sheet's 480px, the consequence
          sentence moves into the sheet's RAISED BOX (it was a bordered-top paragraph, which
          read as a footnote rather than as the promise being made), a clashing name tints
          the FIELD amber as well as the hint, and the free-name hint drops its emerald for
          the sheet's muted tone.

          ⚠ THE EMERALD IS A DELIBERATE SUBTRACTION, NOT AN OVERSIGHT. 199-10 already
          refused the earlier sheet's green-tick "Name available" because colour was
          carrying the meaning; the words were always the signal and the paint was
          redundant beside them. Sheet 200 draws the free state muted and agrees. The
          199-10 assertion that proves the three states differ with EVERY class attribute
          stripped is untouched and still passes — which is exactly why removing the paint
          is safe rather than merely tidy.

          ⚠ AMBER IS NOT DANGER COLOUR. The delete sheet already spends amber for its
          cancel-first banner and red for nothing but its one destructive button; a warning
          tint on a field that still submits is the same register, and §3's "spends danger
          colour: no" is about RED. */}
      <DialogContent
        data-testid="fork-name-dialog"
        className="max-w-[480px]"
        onOpenAutoFocus={(event) => {
          // Focus the FIELD, not the content wrapper: the first thing to do here is type.
          event.preventDefault()
          inputRef.current?.focus()
        }}
      >
        <form
          className="flex flex-col"
          onSubmit={(event) => {
            event.preventDefault()
            // The one hard gate (D-20). Enter on an empty field is the same non-event as a
            // click on the disabled button.
            if (empty) return
            onCreate(trimmed)
          }}
        >
          <DialogHeader>
            <DialogTitle>{FORK_DIALOG_TITLE}</DialogTitle>
            <DialogDescription data-testid="fork-name-sub">
              {forkDialogSub(sourceName)}
            </DialogDescription>
          </DialogHeader>

          {/* The visible heading already reads the label's words, so repeating them on screen
              would be noise — but a screen reader needs the field labelled, and inventing a
              second word for it would be microcopy nobody approved (D-14). The heading's own
              sentence is reused, hidden. */}
          <label htmlFor={INPUT_ID} className="sr-only">
            {FORK_DIALOG_TITLE}
          </label>
          <input
            ref={inputRef}
            id={INPUT_ID}
            data-testid="fork-name-input"
            type="text"
            autoComplete="off"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            // Real DOM text, reachable by a screen reader — the `LibraryToolbar.tsx:223-224`
            // wiring, which is the same rule as the card's `aria-describedby` round trip.
            aria-describedby={`${HINT_ID} ${CONSEQUENCE_ID}`}
            className={cn(
              "mt-4 h-10 w-full rounded-md border bg-background px-3 text-[13.5px] text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary",
              // The sheet's state 2 tints the FIELD as well as the line beneath it, so the
              // warning is attached to the thing it is about. It still submits (D-20).
              clash ? "border-amber-500" : "border-border",
            )}
          />
          {/* ⚠ NOT `role="alert"` (D-20). `InviteMemberDialog.tsx:255` is right to announce
              its 422 as an interruption, because a 422 IS a refusal. This is not one — it is
              described text on a field, and announcing it would tell a screen-reader user
              that something went wrong when nothing did. The warn colour is the shipped
              amber the delete sheet already uses; there is no red on this surface. */}
          <p
            id={HINT_ID}
            data-testid="fork-name-hint"
            className={cn(
              "mt-1.5 min-h-[16px] text-[11px] leading-snug",
              // ⚠ THE FREE ARM IS MUTED, NOT EMERALD — see the DialogContent docblock. The
              // sentence is the signal; the paint was a second, weaker copy of it.
              clash ? "text-amber-400" : "text-muted-foreground",
            )}
          >
            {hint}
          </p>
          {/* The ONE consequence sentence, imported verbatim. It is the same promise the card
              makes before the click, restated at the moment of commitment — and it is the
              only one on this surface. */}
          <p
            id={CONSEQUENCE_ID}
            data-testid="fork-name-consequence"
            className="mt-4 rounded-md border border-border bg-muted/40 p-4 text-[11.5px] leading-snug text-muted-foreground"
          >
            {FORK_CONSEQUENCE}
          </p>

          <DialogFooter className="mt-5 gap-2">
            <button
              type="button"
              data-testid="fork-name-cancel"
              onClick={onCancel}
              className="h-10 rounded-md border border-border px-4 text-[12.5px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {FORK_DIALOG_CANCEL}
            </button>
            {/* ⚠ D-19, CLAUSES 2 AND 4, IN TWO LINES. The word is `Create my copy` — the
                ladder's word is not spent here — and `disabled` reads `empty` ALONE, so a
                colliding name warns and still goes through. */}
            <button
              type="submit"
              data-testid="fork-name-create"
              disabled={empty}
              className="h-10 rounded-md bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {FORK_DIALOG_OK}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
