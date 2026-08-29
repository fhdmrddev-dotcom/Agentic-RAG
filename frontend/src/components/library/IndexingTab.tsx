/**
 * Phase 217 (LIB-01 / D-217-16 / D-217-22) — the Indexing tab body.
 *
 * ⭐ IT COMPOSES `ReembedStatusCard` **UNCHANGED**. That card is not edited by this plan or
 * by any other plan in this phase (D-217-16). It self-fetches, it polls only while running,
 * and it collapses to nothing when the corpus is current — which is exactly why this tab
 * needs facts of its own beside it: an idle library would otherwise render an empty tab.
 *
 * ⛔ ZERO NEW MECHANISM. Every number here comes from the shipped, owner-scoped
 * `GET /settings/reembed-progress` (`getReembedProgress`), the same endpoint the Settings
 * surface already calls. No new endpoint, no new table, no new data path (T-217-34).
 *
 * ── ⚠ D-217-22 — WHY THERE IS A BAR AND AN ELAPSED-TIME GUESS ON THE CARD BELOW ────────
 * `ReembedStatusCard.tsx:146` renders a width-proportion bar and `:163` prints a coarse
 * time guess. D-217-19's "no proportion, no time guess" scopes the INGESTION STRIP and the
 * UPLOAD PATH, where two of six stages are decided while the file runs and there is
 * therefore no honest denominator. Re-embedding HAS one — the live chunk total, derived
 * from the store on every fetch — so that card keeps both. The rule is about honesty, not
 * about a banned shape, and the two surfaces differ in whether the denominator exists.
 *
 * ⛔ THE COVERAGE COUNT IS PRINTED AS NUMERATOR **AND** DENOMINATOR — "87 of 224" — never
 * as a proportion. A bare proportion reads as a quality grade, and coverage is not one.
 *
 * ⚠ An unknown value SAYS SO. A missing total is not zero and not a green tick.
 */
import { useEffect, useState } from "react"
import { getReembedProgress, type ReembedProgress } from "@/lib/api"
import { ReembedStatusCard } from "@/components/settings/ReembedStatusCard"

/** What a fact reads when the server has not told us yet. Never blank, never zero. */
const UNKNOWN = "Not known yet"

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate font-mono text-sm text-foreground" title={value}>
        {value}
      </span>
    </div>
  )
}

export function IndexingTab() {
  const [progress, setProgress] = useState<ReembedProgress | null>(null)
  const [unreachable, setUnreachable] = useState(false)

  // Reconcile-on-fetch (D-v2.5-03): the counts are derived live on the server for every
  // request, so one read at mount is a true reading rather than a cached hint. The card
  // below owns the polling while a run is in flight; duplicating it here would double the
  // request rate for one number.
  useEffect(() => {
    let live = true
    getReembedProgress()
      .then((p) => {
        if (live) setProgress(p)
      })
      .catch(() => {
        if (live) setUnreachable(true)
      })
    return () => {
      live = false
    }
  }, [])

  const total = progress?.total ?? null
  const done = progress?.re_embedded ?? null
  // ⭐ NUMERATOR AND DENOMINATOR. Both halves must be known, or the fact is unknown — a
  // numerator alone would invite the reader to supply their own denominator.
  const coverage = total !== null && done !== null ? `${done} of ${total}` : UNKNOWN
  const model = progress?.model ?? null

  return (
    <section data-testid="indexing-tab" className="flex flex-col gap-4 overflow-y-auto">
      <div>
        <h2 className="text-lg font-semibold leading-tight">Indexing</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          The model the library is searched with, and how much of it that model has read.
        </p>
      </div>

      {/* The shipped card, composed unchanged. It renders nothing while the corpus is
          current — which is the reason the facts below stand on their own. */}
      <ReembedStatusCard id="reembed-status-card" />

      <div className="rounded-xl bg-card/50 ghost-border px-4 py-3">
        <Fact label="Model" value={model ?? UNKNOWN} />
        <Fact label="Chunks indexed" value={coverage} />
        {unreachable && (
          // ⚠ A failed read is stated, never rendered as a zero.
          <p className="pt-2 text-xs text-muted-foreground">
            Could not read the indexing facts just now.
          </p>
        )}
      </div>
    </section>
  )
}
