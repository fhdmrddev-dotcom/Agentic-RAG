/**
 * Phase 194.1 Plan 04 (RUN-01 / R1 + R2) — THE ONE SHARED STOP CONTROL.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS COMPONENT EXISTS AT ALL
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 194 **D-08** binds the RUNTIME half of *four mounts, ONE mechanism*:
 * every Stop calls `stopThread(threadId)`, and nothing reads `workflowLock?.runId`
 * or calls `cancelRun(` directly. This file is the DISPLAY half of the same rule.
 * Four mounts that acknowledge a press four different ways satisfy D-08 and leave
 * the user exactly as confused — which is the defect `BUG-260816-01` is actually
 * about:
 *
 *   > *(a) and (b) are individually minor ergonomics; they are filed at major
 *   > because they are what makes UAT-01 INVISIBLE — a Stop that silently does
 *   > nothing is indistinguishable from a Stop that is working but slow, precisely
 *   > because there is no pending state to distinguish them.*
 *
 * So the pressed state is not decoration. It is the instrument that separates a
 * working Stop from a broken one.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE SHAPE — SKETCH 168-B, "THE CONTROL YIELDS"
 * ─────────────────────────────────────────────────────────────────────────────
 * On press the control **leaves its slot** and `⊘ Stopping this run…` takes it.
 * **There is no disabled button, because there is no button** — a double-press is
 * impossible BY CONSTRUCTION rather than defended against. Variant A (transform
 * in place, disabled) lost on exactly that, and its shape is what the suite's
 * ABSENCE assertions exist to red against (a presence-only check passes it).
 *
 * The mark is the shipped `⊘` (Phase 174 D1/D2, tier-1 deliberate-stop
 * vocabulary) — **no net-new glyph** (D-18). The Stop CONTROL stays the lucide
 * `Square` on every variant: `■` is `RunCard`'s cancelled-STATE glyph, a state and
 * not a control (194-03 refused it for a Stop button; 194-04 drew the
 * complementary half), and `⏹` is in no table in `icon-convention.md` §4.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ ZERO OWNED STATE, AND THAT IS D-05/D-06 MADE STRUCTURAL RATHER THAN POLITE
 * ─────────────────────────────────────────────────────────────────────────────
 * This component declares **no `useState` and no `useEffect`** — it reads two
 * primitive selectors off the StreamsProvider store slice plan 03 shipped, and a
 * single 8s timer per thread lives there too.
 *
 * Two consequences of the rejected alternative, recorded so it is not
 * re-litigated:
 *   - the composer Stop and the panel Stop can be mounted for the SAME thread at
 *     the same time; with component-local state, pressing one would leave the
 *     other pressable, and R1's acceptance is *impossible by construction*;
 *   - component-local state dies on unmount, so navigating away mid-stop would
 *     restore a pressable Stop — a NEW lie, in the one phase whose subject is an
 *     honest Stop.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ THE SLOT RESERVATION GUARDS HEIGHT. **WIDTH IS NOT GUARDED, AND SAYING SO IS
 *   THE POINT** (D-24)
 * ─────────────────────────────────────────────────────────────────────────────
 * The SPEC's acceptance says the composer row's *"measured height and width are
 * identical"* between the two states. Height is: every arm renders inside ONE
 * wrapper whose `className` is byte-identical across arms and carries the shipped
 * `h-8` / `rounded-lg` / `shrink-0` tokens, and the stopping child carries them
 * too.
 *
 * **WIDTH is not, and cannot be asserted here.** jsdom returns 0 for all layout;
 * the resting control is a 32 px icon button and the stopping reading is a text
 * line, so they are genuinely different widths. A fence promising geometry would
 * pass every plant. Width is judged by **G-4 row 1** — *"Press: Stop in the
 * composer on a live run; fails if the button sits inert or **the row twitches**"*
 * (`194.1-VALIDATION.md`), driven by the operator.
 *
 * **Named fallback if the operator judges it twitchy:** clamp the composer
 * variant's reading (a `max-w-*` + `truncate` on `STOPPING_CLASSNAME`, or drop to
 * the shorter `⊘ Stopping…` the sketch uses for the tray row). That is a one-line
 * follow-up, and it is deliberately NOT this plan's scope — a width remedy chosen
 * before anyone has seen the row move is a guess.
 *
 * ⚠ One layout hazard sketch 168-B warned about does NOT apply and the reason is
 * measured rather than assumed: the composer's keyboard hint
 * (`MessageInput.tsx:405-409`) is gated on `!disabled`, so it is ALREADY absent
 * whenever the Stop renders. The stopping reading cannot push it out of the row —
 * there is nothing there to push (`StopControl.baseline.test.tsx` pins that).
 */
import { Button } from "@/components/ui/button"
import { Square } from "lucide-react"
import {
  useStreamActions,
  useStoppingForThread,
  useStopNotConfirmedForThread,
} from "@/providers/StreamsProvider"

/**
 * Sketch 168-B's literal, verbatim. Exported so the four mounts and every fence
 * read ONE string rather than five transcriptions of it.
 */
export const COPY_STOPPING = "⊘ Stopping this run…"

/**
 * The 8s climb-down's reading (R2).
 *
 * ⚠ IT CLAIMS NO CAUSE, AND THAT IS THE WHOLE REQUIREMENT. Its predecessor —
 * *"the run had not finished registering (the pre-stamp window). Nothing was
 * cancelled; press Stop again in a moment."* — explained THREE different failures
 * with one sentence and was wrong for two of them (plan 03 retired both
 * occurrences). This reading is raised by a TIMEOUT: all it knows is that no
 * terminal arrived inside the window. It does not know why, and it must not guess.
 *
 * ⚠ IT DELIBERATELY CARRIES NO STEP COUNT, and that is stated rather than left as
 * an omission. Phase 194 **D-13** — *"every reading carries the step count in the
 * same sentence as the word"* — exists so a STOP does not read as though nothing
 * survived. A stop that was **not confirmed** stopped nothing, so there is no
 * partial work to report and a count here would be a number about a thing that did
 * not happen. The step count belongs on the **stopped receipt** (plan 07's run
 * line), which is the reading D-13 is actually about.
 */
export const COPY_STOP_NOT_CONFIRMED = "The stop was not confirmed — you can press Stop again."

export type StopVariant = "composer" | "panel" | "tray" | "page"

export interface StopControlProps {
  /** The thread whose run is stopped. `null` renders nothing — the mounts pass
   *  `thread?.id ?? null` and a composer with no thread has no run to stop. */
  threadId: string | null
  variant: StopVariant
  /** Per-mount overrides. They DEFAULT to the shipped values below so no mount has
   *  to re-type its own chrome — `WorkspacePanel` keeps its `PANEL_STOP_*` module
   *  constants and passes them, rather than having them moved out from under it. */
  label?: string
  ariaLabel?: string
  testId?: string
}

/**
 * ⚠ THE PANEL AND TRAY STRINGS ARE NOT THE SAME TODAY, and this table preserves
 * that rather than quietly unifying it. They differ by exactly two things — no
 * `ml-auto` on the tray, and `hover:bg-destructive/20 transition-colors` in the
 * opposite order (`194.1-01`'s measurement). Collapsing them into one string is a
 * real visual decision on at least one surface; it is available, it is not taken
 * here, and the suite asserts they stay distinct so the decision cannot be
 * stumbled into.
 *
 * ⚠ The COMPOSER row carries no `className` here on purpose: its rendered value is
 * `buttonVariants({variant:"outline", size:"icon"})` merged with these tokens by
 * shadcn's `<Button>` through tailwind-merge — 27 tokens, of which the source line
 * contributes 8. That is why the composer arm renders a real `<Button>` and not a
 * styled `<button>`: a hand-written string could not reproduce it.
 */
const SHIPPED_CHROME: Record<
  StopVariant,
  {
    testId: string
    slotTestId: string
    ariaLabel: string
    label: string
    /** `null` ⇒ render the shadcn `<Button variant="outline" size="icon">`. */
    className: string | null
    buttonTokens: string
    iconClassName: string
    slotClassName: string
    readingClassName: string
  }
> = {
  // `MessageInput.tsx:410-420`, measured off the rendered DOM by plan 01.
  composer: {
    testId: "composer-stop",
    slotTestId: "composer-stop-slot",
    ariaLabel: "Stop generation",
    label: "",
    className: null,
    buttonTokens:
      "h-8 w-8 rounded-lg shrink-0 transition-all border-destructive/40 text-destructive hover:bg-destructive/10 hover:border-destructive",
    iconClassName: "h-3.5 w-3.5 fill-current",
    // ⚠ NO `w-8` on the slot. The wrapper is a RESERVATION, not a shrink-wrap
    // (168-B's losing-arm note); an `w-8` here would clip the reading outright.
    slotClassName: "flex h-8 items-center gap-2 rounded-lg shrink-0",
    readingClassName:
      "flex h-8 items-center gap-1 rounded-lg shrink-0 whitespace-nowrap text-[11px] text-muted-foreground",
  },
  // `WorkspacePanel.tsx:458-467`.
  panel: {
    testId: "panel-stop-run",
    slotTestId: "panel-stop-slot",
    ariaLabel: "Stop this workflow run",
    label: "Stop",
    className:
      "ml-auto flex shrink-0 items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-[11px] text-destructive transition-colors hover:bg-destructive/20 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
    buttonTokens: "",
    iconClassName: "h-2.5 w-2.5 fill-current",
    slotClassName: "ml-auto flex shrink-0 items-center gap-2",
    readingClassName: "flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] text-muted-foreground",
  },
  // `ActiveRunsTray.tsx:127-133`.
  tray: {
    testId: "tray-stop-run",
    slotTestId: "tray-stop-slot",
    ariaLabel: "Stop run",
    label: "Stop",
    className:
      "flex shrink-0 items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-[11px] text-destructive hover:bg-destructive/20 transition-colors",
    buttonTokens: "",
    iconClassName: "h-2.5 w-2.5 fill-current",
    slotClassName: "flex shrink-0 items-center gap-2",
    readingClassName: "flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] text-muted-foreground",
  },
  // The FOURTH mount. `WorkflowRunPage.tsx` has no Stop control at all today —
  // that is `BUG-260816-01`'s second half and what R3 adds (sketch 169 owns the
  // placement). Its chrome follows the panel's, because a run-level Stop on the
  // run surface is the same act as a run-level Stop in the panel.
  page: {
    testId: "run-page-stop",
    slotTestId: "run-page-stop-slot",
    ariaLabel: "Stop this workflow run",
    label: "Stop",
    className:
      "flex shrink-0 items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-[11px] text-destructive transition-colors hover:bg-destructive/20 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
    buttonTokens: "",
    iconClassName: "h-2.5 w-2.5 fill-current",
    slotClassName: "flex shrink-0 items-center gap-2",
    readingClassName: "flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] text-muted-foreground",
  },
}

export function StopControl({ threadId, variant, label, ariaLabel, testId }: StopControlProps) {
  const actions = useStreamActions()
  const stopping = useStoppingForThread(threadId)
  const notConfirmed = useStopNotConfirmedForThread(threadId)

  const chrome = SHIPPED_CHROME[variant]
  const resolvedTestId = testId ?? chrome.testId
  const resolvedAria = ariaLabel ?? chrome.ariaLabel
  const resolvedLabel = label ?? chrome.label

  // A composer with no thread has no run to stop. Rendering nothing is the honest
  // arm — an inert control is the exact thing this phase exists to remove.
  if (!threadId) return null

  const press = () => void actions.stopThread(threadId)

  const control =
    chrome.className === null ? (
      <Button
        onClick={press}
        size="icon"
        variant="outline"
        aria-label={resolvedAria}
        data-testid={resolvedTestId}
        className={chrome.buttonTokens}
      >
        <Square className={chrome.iconClassName} />
      </Button>
    ) : (
      <button
        type="button"
        onClick={press}
        aria-label={resolvedAria}
        data-testid={resolvedTestId}
        className={chrome.className}
      >
        <Square className={chrome.iconClassName} aria-hidden="true" />
        {resolvedLabel ? <> {resolvedLabel}</> : null}
      </button>
    )

  return (
    <div data-testid={chrome.slotTestId} className={chrome.slotClassName}>
      {stopping ? (
        // ⚠ THE READING ONLY. No disabled button, no `aria-disabled`, no `hidden`
        // — the control is genuinely OUT of the DOM, which is what makes a second
        // press impossible rather than merely discouraged.
        <span
          role="status"
          data-testid={`${variant}-stopping`}
          className={chrome.readingClassName}
        >
          {COPY_STOPPING}
        </span>
      ) : notConfirmed ? (
        <>
          <span
            role="status"
            data-testid={`${variant}-stop-not-confirmed`}
            className={chrome.readingClassName}
          >
            {COPY_STOP_NOT_CONFIRMED}
          </span>
          {control}
        </>
      ) : (
        control
      )}
    </div>
  )
}
