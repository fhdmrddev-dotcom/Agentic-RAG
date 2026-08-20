/**
 * SEED-190 — THE RUN LOG. One place that shows every run, and the door into each one.
 *
 * ⚠ WHAT THIS IS A FIX FOR, in the operator's words: *"in the chat area I cannot distinguish
 * between any regular chat or any workflow run. We should have one place to see the history
 * of the runs and view it."* Before this there was exactly ONE door to `WorkflowRunPage`, and
 * it was inside the run's own chat thread — so to open a run you had to already have found
 * it, in a sidebar that renders a workflow run exactly like a conversation about lunch.
 * Measured on the dev database 2026-08-20: **230 runs, 226 threads, none of them marked.**
 *
 * ⚠ IT IS THE WHOLE LOG, NOT A PER-WORKFLOW HISTORY, and that is the operator's correction to
 * `SEED-190` as originally planted. The seed asked for *"the run history of that specific
 * workflow"*; a per-workflow list answers the complaint above only if you already know which
 * workflow to look inside. So the surface is the log, and the workflow card's door FILTERS it.
 *
 * ⚠ THE FILTER IS BY SLUG, ACROSS VERSIONS. `workflow_runs.definition_id` points at ONE
 * version row, so filtering by definition would show a VERSION's history under a workflow's
 * name. Measured: `pm-weekly-status-report` has 21 runs across 3 definition rows. The wire
 * takes a slug and resolves every definition sharing it; this component just passes it along.
 *
 * ⚠ THIS COMPONENT DERIVES NOTHING AND SPELLS NOTHING. Every sentence comes from
 * `runLogVocabulary.ts`; every per-row fact comes from `runLogRow.ts`, which in turn routes to
 * `runFacts` (the outcome word the CARD prints, so the two cannot disagree), `runSpan` (the
 * duration the RUN PAGE derives, so those two cannot disagree either) and `relativeChanged`'s
 * nine bands. What is here is layout, fetch lifecycle and the three honest states.
 *
 * ⚠ NO URL ROUTER (`SEED-185`), so this is a CLICK PATH: it cannot be linked or bookmarked,
 * and a row opens the run through the callback the page already holds. That is a limitation
 * of the app, recorded rather than worked around — a hand-rolled hash route here would be the
 * first half of a router nobody decided to add.
 *
 * ⚠ `now` IS HOISTED ONCE PER RENDER (P-1). 230 rows each calling `Date.now()` can straddle a
 * band boundary mid-render, so two rows a millisecond apart read as different ages. `192.2-06`
 * fixed exactly this on the library card and the reason is quoted rather than rediscovered.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ApiError, listWorkflowRuns, type WorkflowRunListItem } from "@/lib/api"
import { runLogRowFacts } from "./runLogRow"
import { LOG_GUTTER_TONE, LOG_RUN_TONE } from "./runLogTone"
import {
  FILTER_CLEAR,
  LOAD_MORE,
  LOG_FAILED,
  LOG_LANDMARK,
  LOG_LOADING,
  LOG_RETRY,
  LOG_SUBTITLE,
  LOG_TITLE,
  LOG_UNAVAILABLE,
  NO_RUNS_AT_ALL,
  logCount,
  logSubtitleForWorkflow,
  noRunsForWorkflow,
  openRunLabel,
} from "./runLogVocabulary"

/** How many rows a page of the log holds. 50 against 230 rows today, so the "Showing N of M"
 *  line and the Load-more control are both exercised by the real data rather than only by a
 *  fixture — which is how a paging bug gets found by using the product. */
const PAGE_SIZE = 50

export interface RunLogPanelProps {
  /**
   * Restrict the log to ONE workflow. `null` = the whole log.
   *
   * ⚠ IT CARRIES THE NAME AS WELL AS THE SLUG, because the surface has to SAY which workflow
   * it is filtered to and a slug is a machine name. The caller holds both (the card it was
   * opened from), so resolving the name here would be a second lookup for a fact that was
   * already in hand.
   */
  scope: { slug: string; name: string } | null
  /** Drop the filter and show the whole log. Absent when there is no filter to drop. */
  onClearScope?: () => void
  /**
   * Open a run. This is `ChatLayout.openRunSurface` — the SAME callback the workspace panel's
   * run seam uses, so the log adds a door to the existing room rather than a second room.
   * Absent when the canvas layer is off, in which case rows render as plain text and offer
   * nothing to click: a dead control is worse than an absent one.
   */
  onOpenRun?: (runId: string) => void
}

export function RunLogPanel({ scope, onClearScope, onOpenRun }: RunLogPanelProps) {
  const [rows, setRows] = useState<WorkflowRunListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  /** `null` = no failure. Two failure words, because a canvas-off 404 and a 5xx are different
   *  facts and a person can act on one of them. */
  const [failure, setFailure] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  /**
   * ⚠ THE IN-FLIGHT READ IS ABORTED ON A SCOPE CHANGE, AND THE REASON IS LATEST-WINS RATHER
   * THAN TIDINESS. Clicking "Show all runs" while the filtered page is still arriving would
   * otherwise let the older response land last and repaint the filtered rows under the
   * unfiltered heading — a surface stating one thing and showing another. The generation
   * counter is the belt to the abort's braces, because an abort that lands after the `await`
   * resolves does not un-resolve it.
   */
  const generation = useRef(0)

  const load = useCallback(
    async (offset: number) => {
      const mine = ++generation.current
      if (offset === 0) {
        setLoading(true)
        setFailure(null)
      } else {
        setLoadingMore(true)
      }
      try {
        const page = await listWorkflowRuns({
          ...(scope ? { slug: scope.slug } : {}),
          limit: PAGE_SIZE,
          offset,
        })
        if (generation.current !== mine) return
        setRows((prev) => (offset === 0 ? page.runs : [...prev, ...page.runs]))
        setTotal(page.total)
      } catch (err) {
        if (generation.current !== mine) return
        // ⚠ A FAILURE IS NEVER RENDERED AS AN EMPTY LOG. "We could not look" and "we looked and
        // there is nothing" are different facts, and showing the second when the first is true
        // is how a surface tells a person their work is gone.
        setFailure(err instanceof ApiError && err.status === 404 ? LOG_UNAVAILABLE : LOG_FAILED)
        if (offset === 0) setRows([])
      } finally {
        if (generation.current === mine) {
          setLoading(false)
          setLoadingMore(false)
        }
      }
    },
    [scope],
  )

  useEffect(() => {
    void load(0)
  }, [load])

  // P-1 — ONE clock for the whole render. See this file's header.
  const now = Date.now()
  const facts = useMemo(
    () => rows.map((row) => runLogRowFacts(row, now)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `now` is deliberately a
    // per-render value: including it would defeat the memo, and excluding it is what makes
    // every row in ONE render agree on the instant they are measured against.
    [rows],
  )

  const subtitle = scope === null ? LOG_SUBTITLE : logSubtitleForWorkflow(scope.name)
  const emptyWord = scope === null ? NO_RUNS_AT_ALL : noRunsForWorkflow(scope.name)

  return (
    <section
      data-testid="run-log"
      aria-label={LOG_LANDMARK}
      className="flex h-full min-h-0 flex-col bg-background"
    >
      <header className="flex flex-col gap-1 border-b border-border px-6 pb-4 pt-6">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.02em] text-foreground">
            {LOG_TITLE}
          </h1>
          {scope !== null && onClearScope ? (
            <button
              type="button"
              data-testid="run-log-clear-scope"
              onClick={onClearScope}
              className="rounded-md border border-border px-2.5 py-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {FILTER_CLEAR}
            </button>
          ) : null}
        </div>
        <p data-testid="run-log-subtitle" className="text-[14px] leading-normal text-muted-foreground">
          {subtitle}
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* ⚠ LOADING RENDERS NO COUNT. A count of 0 during a load is a lie — the
            `WorkflowsPage` D-16 rule, applied at the surface it was written for. */}
        {loading ? (
          <p data-testid="run-log-loading" className="px-6 py-4 text-[13px] text-muted-foreground">
            {LOG_LOADING}
          </p>
        ) : null}

        {failure !== null ? (
          <div
            data-testid="run-log-failed"
            role="status"
            className="mx-6 mt-4 flex items-center justify-between gap-3 rounded-md border border-warning/40 bg-warning/10 px-4 py-2.5"
          >
            <span className="text-[13px] font-medium text-warning">{failure}</span>
            <button
              type="button"
              data-testid="run-log-retry"
              onClick={() => void load(0)}
              className="rounded-md border border-border px-2.5 py-1 text-[12px] text-foreground transition-colors hover:border-muted-foreground"
            >
              {LOG_RETRY}
            </button>
          </div>
        ) : null}

        {!loading && failure === null && rows.length === 0 ? (
          <p data-testid="run-log-empty" className="px-6 py-8 text-[13px] text-muted-foreground">
            {emptyWord}
          </p>
        ) : null}

        {rows.length > 0 ? (
          <>
            <p
              data-testid="run-log-count"
              className="px-6 pb-1 pt-4 text-[12px] text-muted-foreground"
            >
              {logCount(rows.length, total)}
            </p>

            <ul className="flex flex-col px-6 pb-6">
              {facts.map((row) => {
                // ⚠ THE OUTCOME IS A WORD AND A DOT, NEVER A DOT ALONE. "Colour, and never
                // colour alone" is the card's standing rule and it is not weaker here — the
                // dot is `aria-hidden` and the sentence beside it carries the whole fact.
                const dot = LOG_GUTTER_TONE[row.tone]
                const word = LOG_RUN_TONE[row.tone]
                const body = (
                  <>
                    <span
                      aria-hidden="true"
                      data-run={row.tone}
                      className={`h-2 w-2 flex-none rounded-full ${dot}`}
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
                      <span
                        data-testid="run-log-row-title"
                        className={`truncate text-[14px] font-medium ${
                          row.orphaned ? "text-muted-foreground" : "text-foreground"
                        }`}
                      >
                        {row.title}
                      </span>
                      <span
                        data-testid="run-log-row-detail"
                        className="truncate text-[11px] text-muted-foreground"
                      >
                        {row.detail}
                      </span>
                    </span>
                    <span
                      data-testid="run-log-row-outcome"
                      data-run={row.tone}
                      className={`flex-none text-[12px] ${word}`}
                    >
                      {row.fact.word}
                    </span>
                    {/* ⚠ THE NOT-RECORDED WORD GETS ITS OWN SLOT AND IS NOT FOLDED INTO THE
                        DETAIL LINE. It is a sentence, not a figure, and most rows take it
                        today (migration 121 is not backfilled). It renders NOTHING when the
                        duration IS measured — that figure is already on the detail line. */}
                    {row.durationMeasured ? null : (
                      <span
                        data-testid="run-log-row-untimed"
                        className="hidden flex-none text-[11px] text-muted-foreground sm:inline"
                      >
                        {row.duration}
                      </span>
                    )}
                  </>
                )

                return (
                  <li key={row.runId} data-testid={`run-log-row-${row.runId}`}>
                    {onOpenRun ? (
                      <button
                        type="button"
                        aria-label={openRunLabel(row.title)}
                        onClick={() => onOpenRun(row.runId)}
                        className="flex w-full items-center gap-3 rounded-md border-b border-border/60 px-2 py-3 text-left transition-colors hover:bg-card/60"
                      >
                        {body}
                      </button>
                    ) : (
                      // ⚠ NO CONTROL WHEN THERE IS NOWHERE TO GO. With the canvas layer off
                      // the run surface does not exist, and a button that does nothing is
                      // worse than a row that never claimed to be one.
                      <div className="flex w-full items-center gap-3 border-b border-border/60 px-2 py-3">
                        {body}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>

            {rows.length < total ? (
              <div className="px-6 pb-8">
                <button
                  type="button"
                  data-testid="run-log-more"
                  disabled={loadingMore}
                  onClick={() => void load(rows.length)}
                  className="rounded-md border border-border px-3 py-1.5 text-[13px] text-foreground transition-colors hover:border-muted-foreground disabled:opacity-60"
                >
                  {LOAD_MORE}
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  )
}
