/**
 * Phase 217.1 plan 10 (LIB-01 / BE-2 / D-217.1-27) — the Indexing tab body.
 *
 * ⭐ IT COMPOSES `ReembedStatusCard` **UNCHANGED** (D-217-16) — self-fetching, never edited
 * here, collapsed to nothing when the corpus is current.
 *
 * ⛔ THE THREE CARDS COME FROM **ONE** FETCH. A single `useEffect` calls
 * `getIndexSummary()` (Plan 09's `GET /library/index-summary`, ungated per D-217.1-27) and
 * passes the result down as props — no card fetches independently.
 *
 * ⭐ FACTS FOR EVERYONE, ACTIONS ONLY FOR OPERATORS (closes 217's deferred WR-02):
 * Vector store / Embedding model / Folders numbers render unconditionally. The three ACTION
 * buttons (`Change model`, `Re-index everything`, `Re-index selected`) render ONLY when
 * `features.model_management === true`, using the shipped VANISH convention (`nav-items.ts`
 * `visibleNavItems`) — absent, never disabled. `Change model` routes to Settings' shipped
 * picker via the exact `onNavigate("settings")` + scroll shape `LibraryPage.tsx:585-597`
 * uses — no second picker is created.
 *
 * ⛔ HONESTY: `Uncategorized`/`Root` reads `–` and `never`, never `0` and never a tick
 * (D-217.1-31 — the point of the tab).
 */
import { useEffect, useState } from "react"
import { getIndexSummary, type IndexSummary } from "@/lib/api"
import { ReembedStatusCard } from "@/components/settings/ReembedStatusCard"
import { useEffectiveFeaturesOptional } from "@/providers/EffectiveFeaturesProvider"
import { VectorStoreCard } from "@/components/library/indexing/VectorStoreCard"
import { EmbeddingModelCard } from "@/components/library/indexing/EmbeddingModelCard"
import { FoldersIndexTable } from "@/components/library/indexing/FoldersIndexTable"

export function IndexingTab({ onNavigate }: { onNavigate?: (view: string) => void } = {}) {
  const [summary, setSummary] = useState<IndexSummary | null>(null)
  const [unreachable, setUnreachable] = useState(false)

  // ⛔ ONE FETCH — the three cards' data. ReembedStatusCard self-fetches and is untouched.
  useEffect(() => {
    let live = true
    getIndexSummary()
      .then((s) => {
        if (live) setSummary(s)
      })
      .catch(() => {
        if (live) setUnreachable(true)
      })
    return () => {
      live = false
    }
  }, [])

  // The VANISH gate: only `model_management === true` renders the ACTION buttons. Absent
  // for everyone else — never disabled (T-217.1-02 / the nav-items.ts convention).
  const featuresCtx = useEffectiveFeaturesOptional()
  const canManage = featuresCtx?.features.model_management === true

  return (
    <section data-testid="indexing-tab" className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold leading-tight">Indexing</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          The model the library is searched with, and how much of it that model has read.
        </p>
      </div>

      {/* The shipped card, composed unchanged. It renders nothing while the corpus is
          current — which is the reason the facts below stand on their own. */}
      <ReembedStatusCard id="reembed-status-card" />

      {unreachable ? (
        // ⚠ A failed read is stated, never rendered as a zero.
        <p className="text-sm text-muted-foreground">
          Could not read the indexing facts just now.
        </p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {/* 217.1-18 — the contract's block hooks. */}
            <div data-testid="indexing-vector-store-card">
              <VectorStoreCard summary={summary} />
            </div>
            <div data-testid="indexing-embedding-model-card">
              <EmbeddingModelCard summary={summary} canManage={canManage} onNavigate={onNavigate} />
            </div>
          </div>
          <div data-testid="indexing-folders-table">
            <FoldersIndexTable summary={summary} canManage={canManage} />
          </div>
        </>
      )}
    </section>
  )
}
