/**
 * Phase 184-08 Task 3 (VALID-03 · R8 · R9 · D-184-14 · sketch 139-A) — ProblemsTray.
 *
 * THE BOTTOM TRAY. It says how the draft is doing in two separate words before it is
 * opened, and when it is opened it lists every finding the server sent — including the
 * ones that belong to no step at all.
 *
 * ── THE TWO-COUNT SUMMARY IS THE POINT, AND IT LIVES IN THE CLOSED STATE ──
 * *"1 problem · 2 things to finish."* Both severities set `ok:false` and both block a
 * publish, so a surface that merges them into one number tells a person they have done
 * something wrong every time they pause halfway — and "not finished yet" is the state
 * a canvas spends most of its life in. Separating them in WORDS, at rest, is what
 * keeps that from happening, which is why the line renders closed and not only after
 * expansion. It is also the second of the two reasons sketch 139 variant A won.
 *
 * ── THE `phase: null` HOME — the FIRST reason A won ──
 * A finding whose `phase` is `null` belongs to the workflow, not to any one step:
 * "this still needs a one-line description" points at no node on the canvas. Variant B
 * rendered verdicts inside the step they belonged to and therefore lost those findings
 * from the surface entirely. This tray gives them their own section, and that section
 * renders even when it is the only thing in the tray.
 *
 * ── EVERY FINDING RENDERS, INCLUDING THE ONES THIS CLIENT HAS NEVER SEEN ──
 * Nothing is filtered, nothing is re-ordered, and no message is rewritten: the row
 * shows the server's own `message` verbatim. There is no code table here and no
 * friendly-message map — Phase 185 ships new findings as new identifiers in the module
 * that owns them, and this tray renders them with no edit at all (D-182-06). The raw
 * `code` appears only behind the ⌥ Technical-names reveal, read through the shipped
 * fail-closed optional accessor, so a business surface stays business-plain by default.
 *
 * ── WHEN THE CHECK ITSELF DID NOT RUN (D-184-14) ──
 * The wording is split by CAUSE, because a reproducible shape rejection and a network
 * blip need different things from the reader and a user hitting the first must not be
 * told to retry forever. Held-stale findings stay VISIBLE rather than being cleared —
 * replacing them with silence would read as "everything is fine now", which is the
 * exact "registry blip rendered as a green light" failure sketch 139 names. Nothing in
 * this state renders a clean or passing affordance, and the 422 body never reaches
 * here at all: it is logged at the api boundary and carried no further.
 *
 * ── WHAT THIS COMPONENT DELIBERATELY DOES NOT DO ──
 *  - It does NOT auto-open on a new problem. The summary line updates and the author
 *    opens it when they are ready; a tray that springs open mid-build fights the person
 *    using it (CONTEXT, Claude's discretion). `open` is owned by the caller and this
 *    component only ever asks for a toggle.
 *  - It does NOT clear rows while a check is in flight — it DIMS them. Clearing makes
 *    the marks flicker on every keystroke.
 *  - It holds no store reference, opens no request and names no route. It is a leaf:
 *    it renders what it is given and calls back, so it tests under a plain `render()`
 *    with no provider and no canvas-graph shim.
 *
 * XSS (T-184-08-01): every server-authored string — the message, the identifier —
 * renders as a plain React text child. React escapes text children; the raw-HTML prop
 * is never used here. The rule that already covered authored phase names covers these.
 */
import { useEffect, useId, useMemo, useState } from "react"

import { VERDICT_MARK } from "@/components/workflows/nodePresentation"
import {
  nodeTitle,
  technicalTitle,
  type PhaseSpecJSON,
} from "@/components/workflows/phaseVocabulary"
import {
  DEGRADED_SENTENCE,
  summaryLine,
  type VerdictGroups,
} from "@/components/workflows/verdictModel"
import { useTechnicalNamesOptional } from "@/providers/TechnicalNamesProvider"
import { cn } from "@/lib/utils"
// Type-only: the live loop owns the cause union. This component declares no second
// spelling of it, so a rename there is a typecheck error here rather than a silent
// branch that stops matching.
import type { DegradedValidationCause } from "@/hooks/useLiveValidation"

/** The word for what is happening right now, when something IS happening. */
const CHECKING_BEAT = "checking…"

/** The resting attribution. It says who did the checking, never that the draft is fine. */
const CHECKED_BEAT = "checked by the server"

export interface ProblemsTrayProps {
  /** The grouped server response — `verdictModel.groupVerdicts` output, nothing else. */
  groups: VerdictGroups
  /** The definition's phases, used ONLY to put a plain-language name on a row. A slug
   *  with no matching phase still renders; it just names itself. */
  phases: readonly PhaseSpecJSON[]
  /** `null` when the last check answered. Otherwise why it did not. */
  degraded: DegradedValidationCause | null
  /** A check is in flight: dim what is shown, do not clear it. */
  checking: boolean
  /** Owned by the caller. This component never opens itself. */
  open: boolean
  /** The summary line was activated. */
  onToggle: () => void
  /** A phase-keyed row was activated — take the author to that step. */
  onJumpToStep: (slug: string) => void
}

/** The mark a row wears. The ONLY comparison is against the soft severity; anything
 *  else is the hard one, mirroring the route's fail-closed default (and matching
 *  `verdictModel.markFor`, so a node's corner and its tray row can never disagree). */
function markForSeverity(severity: string) {
  return severity === "incomplete" ? VERDICT_MARK.incomplete : VERDICT_MARK.error
}

export function ProblemsTray({
  groups,
  phases,
  degraded,
  checking,
  open,
  onToggle,
  onJumpToStep,
}: ProblemsTrayProps) {
  const listId = useId()

  // The app-wide reveal, READ (never owned) here — the shipped fail-closed accessor.
  // Null outside a provider means plain language, no control, no crash.
  const showTechnical = useTechnicalNamesOptional()?.showTechnical ?? false

  const phaseBySlug = useMemo(
    () => new Map(phases.map((phase) => [phase.slug, phase])),
    [phases],
  )

  const hasAnyVerdict = groups.byPhase.size > 0 || groups.workflowWide.length > 0
  const counts = summaryLine(groups)

  // While degraded with nothing held over, the counts line would be the CLEAN form —
  // and "nothing to fix" is precisely the lie this state must not tell. The degraded
  // sentence stands alone instead. With held-stale findings both are shown: they are
  // still true, and they are still not a verdict on the current shape.
  const showCounts = hasAnyVerdict || degraded === null

  const announcement = degraded ? DEGRADED_SENTENCE[degraded] : counts

  // The polite announcer in the shipped `PhaseTimeline.tsx:170-175` shape: present at
  // load, written only when the sentence actually changes, so a count change is not
  // silent for a screen-reader user and an unchanged one is not re-read.
  const [announced, setAnnounced] = useState("")
  useEffect(() => {
    setAnnounced(announcement)
  }, [announcement])

  const phaseRows: { slug: string; verdict: (typeof groups.workflowWide)[number] }[] = []
  for (const [slug, list] of groups.byPhase) {
    for (const verdict of list) phaseRows.push({ slug, verdict })
  }

  return (
    <section
      data-testid="problems-tray"
      data-open={open ? "true" : "false"}
      data-degraded={degraded ?? "false"}
      aria-label="Problems and unfinished steps"
      className="flex flex-col-reverse border-t border-border/60 bg-card/40 backdrop-blur-sm"
    >
      {/* The tray expands UPWARD from its summary line (sketch 141-B: one bottom
          region, two rows maximum), which is why the column is reversed. */}
      <div
        role="status"
        aria-live="polite"
        className="sr-only"
        data-testid="problems-tray-announcer"
      >
        {announced}
      </div>

      <button
        type="button"
        data-testid="problems-tray-summary"
        aria-expanded={open}
        aria-controls={listId}
        onClick={onToggle}
        className={cn(
          "flex w-full items-center gap-2 px-4 py-2 text-left text-[12.5px] text-foreground",
          "hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
        )}
      >
        <span aria-hidden="true" className="text-muted-foreground">
          {open ? "▾" : "▸"}
        </span>

        {showCounts ? (
          <span data-testid="problems-tray-counts">{counts}</span>
        ) : null}

        {degraded ? (
          <span data-testid="problems-tray-degraded" className="text-muted-foreground">
            {DEGRADED_SENTENCE[degraded]}
          </span>
        ) : null}

        <span className="flex-1" />

        {/* No resting attribution while degraded: "checked by the server" is not true
            when the check did not run, and this strip must not imply that it did. */}
        {checking || !degraded ? (
          <span data-testid="problems-tray-beat" className="text-[11px] text-muted-foreground">
            {checking ? CHECKING_BEAT : CHECKED_BEAT}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          id={listId}
          data-testid="problems-tray-list"
          data-stale={checking ? "true" : "false"}
          className={cn(
            "max-h-[220px] overflow-auto px-2 pb-2",
            // Dimmed, never cleared, while the next answer is in flight.
            checking && "opacity-60",
          )}
        >
          {phaseRows.map(({ slug, verdict }, index) => {
            const mark = markForSeverity(verdict.severity)
            const phase = phaseBySlug.get(slug)
            return (
              <button
                key={`${slug}-${index}`}
                type="button"
                data-testid={`problems-tray-row-${slug}-${index}`}
                data-severity={verdict.severity}
                data-slug={slug}
                onClick={() => onJumpToStep(slug)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-[9px] border-0 bg-transparent px-2 py-[7px]",
                  "text-left text-[12px] text-foreground",
                  "hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-[1px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full",
                    "text-[10px] font-bold leading-none",
                    mark.className,
                  )}
                >
                  {mark.glyph}
                </span>
                <span className="sr-only">{mark.label}</span>
                <span className="min-w-0 flex-1">
                  <strong className="font-semibold">
                    {phase ? nodeTitle(phase) : slug}
                  </strong>{" "}
                  — <span data-testid="problems-tray-message">{verdict.message}</span>
                  {showTechnical ? (
                    <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
                      {verdict.code} · {phase ? technicalTitle(phase) : slug}
                    </span>
                  ) : null}
                </span>
              </button>
            )
          })}

          {groups.workflowWide.length > 0 ? (
            <div data-testid="problems-tray-workflow-wide" className="mt-1">
              <p className="px-2 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
                The workflow
              </p>
              {groups.workflowWide.map((verdict, index) => {
                const mark = markForSeverity(verdict.severity)
                return (
                  <div
                    key={`workflow-wide-${index}`}
                    data-testid={`problems-tray-workflow-row-${index}`}
                    data-severity={verdict.severity}
                    // No jump target and therefore no control: this finding belongs to
                    // no step, and a button that goes nowhere is worse than a line of
                    // text that admits it.
                    className="flex w-full items-start gap-2 px-2 py-[7px] text-left text-[12px] text-foreground"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-[1px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full",
                        "text-[10px] font-bold leading-none",
                        mark.className,
                      )}
                    >
                      {mark.glyph}
                    </span>
                    <span className="sr-only">{mark.label}</span>
                    <span className="min-w-0 flex-1">
                      <span data-testid="problems-tray-message">{verdict.message}</span>
                      {showTechnical ? (
                        <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
                          {verdict.code} · workflow-wide
                        </span>
                      ) : null}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : null}

          {!hasAnyVerdict && !degraded ? (
            <p
              data-testid="problems-tray-empty"
              className="px-2 py-2 text-[12px] text-muted-foreground"
            >
              Nothing outstanding. Publishing still has to run its golden run and its judge —
              this only speaks for the static half.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
