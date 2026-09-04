/**
 * Phase 217 Plan 11 Task 2 — DocumentQueriesSection (LIB-04 / D-217-06 / D-217-07).
 *
 * "Found by" — the questions that actually returned this document. Nothing here is new
 * data: every search the agent runs already writes a `search.query` audit row carrying
 * the question and the document ids it returned, so this list is a GROUP BY over rows the
 * product has kept all along. It answers the one thing a person really wants to know
 * about a document in a knowledge base: what is this being used for?
 *
 * ⭐ THE WINDOW IS 30 DAYS AND THE LABEL IS PINNED TO THE BACKEND'S CONSTANT, not
 * re-decided here. `document_queries.py` imports `WINDOW_DAYS` from `knowledge_health.py`
 * (`:27`) precisely so the query and its label cannot drift; sketch fence `A6e` asserts
 * that pinning, so a different number in this file would contradict a live assertion. The
 * route is also capped at 100 rows, newest first — a heavily-retrieved document shows its
 * most recent 100 searches, not all of them, and the footer says so rather than implying
 * a complete census.
 *
 * ⛔ A ROW MAY CARRY NO QUESTION TEXT, AND THAT MUST READ AS A SENTENCE. The D-115-10
 * view/filter path (`tool_dispatcher.py:958-965`) records a `via` and no `query_text`, so
 * `query_text` is null on those rows. This section names what happened — "A saved view
 * returned it" — and never invents a placeholder question, never prints an empty quote,
 * and never lets a missing value reach the DOM as the word JavaScript would have printed
 * for it. That word is deliberately absent from this file so a fence looking for it
 * cannot be satisfied by a comment.
 *
 * ⛔ Lazy by construction: the mount in `DocumentDetailPanel` is closed by default and
 * `PanelSection.tsx:94` renders children only when open.
 *
 * ⚠ The question text is the CALLER'S OWN past search, echoed back to them. It renders as
 * a React text child, which escapes; the raw-HTML injection prop appears nowhere in this
 * file and none may be added.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { listDocumentQueries } from "@/lib/api"
import type { DocumentQueryRow } from "@/types"
import { FoundPerWeekSparkline, bucketByWeek } from "@/components/library/FoundPerWeekSparkline"

export interface DocumentQueriesSectionProps {
  /** The open document — the subject of the read. */
  docId: string
  /** Lift the number of recorded searches so the parent `PanelSection` can badge it. */
  onTotalChange?: (total: number) => void
}

type LoadState = "loading" | "ready" | "error"

/** The backend's rolling window, mirrored for the label only (`knowledge_health.py:27`).
 *  The query itself is bounded server-side; this constant never travels the other way. */
export const QUERIES_WINDOW_DAYS = 30

/** The one empty claim this section can honestly make. */
export const QUERIES_EMPTY = "No searches have returned this document in the last 30 days"

/** The sentence for a row that recorded no question text. Worded per source, because
 *  "a saved view returned it" and "a filter returned it" are different events. */
export function queryLabel(row: DocumentQueryRow): { text: string; verbatim: boolean } {
  const q = row.query_text
  if (typeof q === "string" && q.trim() !== "") return { text: q, verbatim: true }
  if (row.via === "view") return { text: "A saved view returned it", verbatim: false }
  if (row.via === "filter") return { text: "A filter returned it", verbatim: false }
  return { text: "Returned without a recorded question", verbatim: false }
}

interface GroupedQuery {
  key: string
  label: string
  verbatim: boolean
  count: number
  /** The most recent `asked_at` in the group — the rows arrive newest-first. */
  lastAsked: string
}

/** Group identical questions so frequency is visible. A list without frequency decides
 *  nothing: four separate rows of the same question hide that it is the question. */
export function groupQueries(rows: DocumentQueryRow[]): GroupedQuery[] {
  const out: GroupedQuery[] = []
  const index = new Map<string, GroupedQuery>()
  for (const row of rows) {
    const { text, verbatim } = queryLabel(row)
    const key = `${verbatim ? "q" : "v"}:${text}`
    const found = index.get(key)
    if (found) {
      found.count += 1
      continue
    }
    const entry: GroupedQuery = { key, label: text, verbatim, count: 1, lastAsked: row.asked_at }
    index.set(key, entry)
    out.push(entry)
  }
  return out
}

export function DocumentQueriesSection({ docId, onTotalChange }: DocumentQueriesSectionProps) {
  const [rows, setRows] = useState<DocumentQueryRow[]>([])
  const [state, setState] = useState<LoadState>("loading")

  const load = useCallback(async () => {
    setState("loading")
    setRows([])
    try {
      const res = await listDocumentQueries(docId)
      setRows(res)
      setState("ready")
      onTotalChange?.(res.length)
    } catch {
      setState("error")
    }
  }, [docId, onTotalChange])

  useEffect(() => {
    void load()
  }, [load])

  const groups = useMemo(() => groupQueries(rows), [rows])

  // ── Plan 15 RETRIEVAL summary ─────────────────────────────────────────────
  const retrievalSummary = useMemo(() => {
    if (state !== "ready" || rows.length === 0) return null
    const MAX_ROWS = 100
    const timesFound = rows.length >= MAX_ROWS ? `${MAX_ROWS}+` : String(rows.length)
    const lastFound = rows[0].asked_at
    const lastQuestion = rows[0].query_text ?? null
    const sims = rows.map((r) => r.similarity).filter((s): s is number => s != null)
    const avgRelevance =
      sims.length > 0
        ? `${Math.round((sims.reduce((a, b) => a + b, 0) / sims.length) * 100)}%`
        : "not recorded yet"
    const sparklineDates = rows.map((r) => r.asked_at)
    const weekBuckets = bucketByWeek(sparklineDates)

    return { timesFound, lastFound, lastQuestion, avgRelevance, weekBuckets }
  }, [rows, state])

  return (
    <div className="flex flex-col gap-3 px-4 pt-1">
      {state === "loading" && (
        <div role="status" aria-live="polite" className="flex flex-col gap-2 py-1">
          <span className="sr-only">Loading the searches that found this document</span>
          <div aria-hidden="true" className="h-8 w-full animate-pulse rounded-md bg-border/30" />
        </div>
      )}

      {state === "error" && (
        <div className="flex flex-col gap-2 py-1">
          <p role="alert" className="text-sm text-[hsl(0_80%_80%)]">
            Couldn&rsquo;t load the searches that found this document
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="self-start rounded-md text-xs text-panel-muted-foreground underline-offset-2 hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            Try again
          </button>
        </div>
      )}

      {state === "ready" && rows.length === 0 && (
        <p className="py-1 text-sm text-panel-muted-foreground">{QUERIES_EMPTY}</p>
      )}

      {state === "ready" && rows.length > 0 && (
        <>
          {/* ── RETRIEVAL summary block (Plan 15) ─────────────────── */}
          {retrievalSummary && (
            <div className="flex items-start justify-between gap-4 mb-1">
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs min-w-0">
                <span className="text-panel-muted-foreground">Times found</span>
                <span className="text-foreground text-right tabular-nums">{retrievalSummary.timesFound}</span>

                <span className="text-panel-muted-foreground">Last question</span>
                <span className="text-foreground text-right truncate max-w-[160px]">
                  {retrievalSummary.lastQuestion
                    ? retrievalSummary.lastQuestion.length > 30
                      ? `${retrievalSummary.lastQuestion.slice(0, 30)}…`
                      : retrievalSummary.lastQuestion
                    : "Saved view / filter"}
                </span>

                <span className="text-panel-muted-foreground">Last found</span>
                <span className="text-foreground text-right tabular-nums">
                  {new Date(retrievalSummary.lastFound).toLocaleDateString()}
                </span>

                <span className="text-panel-muted-foreground">Average relevance</span>
                <span className="text-foreground text-right tabular-nums">
                  {retrievalSummary.avgRelevance}
                </span>
              </div>

              <div className="shrink-0">
                <div className="text-[10px] text-panel-muted-foreground mb-0.5 text-right">
                  FOUND PER WEEK
                </div>
                <FoundPerWeekSparkline weeks={retrievalSummary.weekBuckets} />
              </div>
            </div>
          )}

          <p className="text-[0.7rem] text-panel-muted-foreground-dim">
            {rows.length} {rows.length === 1 ? "search" : "searches"} in the last{" "}
            {QUERIES_WINDOW_DAYS} days
          </p>
          <ul className="flex flex-col gap-1">
            {groups.map((g) => (
              <li
                key={g.key}
                className="flex items-baseline gap-2 rounded-md border border-border/40 bg-background/40 px-2 py-1.5"
              >
                <span aria-hidden="true" className="text-panel-muted-foreground-dim">
                  &#8981;
                </span>
                {/* A React text child either way. A verbatim question is quoted and set in
                    mono so it reads as the person's own words; a worded alternative is
                    italic prose, so the two can never be mistaken for each other. */}
                {g.verbatim ? (
                  <span className="min-w-0 flex-1 break-words font-mono text-[0.74rem] text-foreground">
                    &ldquo;{g.label}&rdquo;
                  </span>
                ) : (
                  <span className="min-w-0 flex-1 break-words text-[0.74rem] italic text-panel-muted-foreground">
                    {g.label}
                  </span>
                )}
                <span className="font-mono text-[0.7rem] font-semibold text-panel-muted-foreground">
                  {g.count}&times;
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

export default DocumentQueriesSection
